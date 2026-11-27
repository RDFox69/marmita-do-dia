import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from app import create_app


class MarmitaApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        database_path = Path(self.temporary_directory.name) / "test.sqlite3"
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-key-not-for-production",
            "DATABASE_PATH": str(database_path),
        })
        self.client = self.app.test_client()
        self.database_path = database_path

    def tearDown(self):
        self.temporary_directory.cleanup()

    def csrf(self, client):
        return client.get("/api/session").get_json()["csrfToken"]

    def signup(self, client, email, account_type="customer"):
        token = self.csrf(client)
        response = client.post(
            "/api/auth/signup",
            json={
                "email": email,
                "password": "senha-segura-123",
                "fullName": email.split("@")[0].title(),
                "phone": "(11) 99999-0000",
                "accountType": account_type,
                "role": "operator",
            },
            headers={"X-CSRF-Token": token},
        )
        return response

    def order_payload(self, **overrides):
        payload = {
            "customer": {"name": "Nome falso", "phone": "000", "address": "Rua das Flores, 10"},
            "productId": "frango",
            "quantity": 2,
            "customizations": ["Sem feijão"],
            "addonIds": ["farofa"],
            "notes": "Molho separado",
            "fulfillment": "delivery",
            "paymentMethod": "pix",
            "paymentStatus": "paid",
        }
        payload.update(overrides)
        return payload

    def create_order(self, client, **overrides):
        return client.post(
            "/api/orders",
            json=self.order_payload(**overrides),
            headers={"X-CSRF-Token": self.csrf(client)},
        )

    def set_role(self, email, role):
        database = sqlite3.connect(self.database_path)
        try:
            database.execute("UPDATE users SET role = ? WHERE email = ?", (role, email))
            if role == "operator":
                database.execute(
                    """UPDATE operator_access_requests SET status = 'approved'
                       WHERE user_id = (SELECT id FROM users WHERE email = ?)""",
                    (email,),
                )
            database.commit()
        finally:
            database.close()

    def test_public_signup_never_grants_operator_role_and_operator_access_requires_approval(self):
        customer = self.signup(self.client, "customer@example.com")
        self.assertEqual(customer.status_code, 201)
        self.assertEqual(customer.get_json()["profile"]["role"], "customer")
        self.assertFalse(customer.get_json()["operatorAccessPending"])
        self.assertIn("HttpOnly", customer.headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", customer.headers["Set-Cookie"])

        request_client = self.app.test_client()
        request = self.signup(request_client, "kitchen@example.com", account_type="operator")
        self.assertEqual(request.status_code, 201)
        self.assertEqual(request.get_json()["profile"]["role"], "customer")
        self.assertTrue(request.get_json()["operatorAccessPending"])
        self.assertEqual(request_client.get("/api/orders").get_json(), [])

    def test_order_total_eta_and_customer_details_are_calculated_on_server(self):
        self.signup(self.client, "ana@example.com")
        now = datetime(2026, 11, 27, 18, 0, tzinfo=timezone.utc)
        with patch("app.utc_now", return_value=now):
            response = self.create_order(self.client)

        self.assertEqual(response.status_code, 201)
        order = response.get_json()
        self.assertEqual(order["totalCents"], 5580)
        self.assertEqual(order["paymentStatus"], "pending")
        self.assertEqual(order["status"], "waiting")
        self.assertEqual(order["customer"]["name"], "Ana")
        self.assertEqual(order["customer"]["phone"], "(11) 99999-0000")
        self.assertEqual(order["estimatedReadyAt"], "2026-11-27T18:35:00Z")
        self.assertEqual(order["extras"][0]["id"], "farofa")

    def test_invalid_order_values_and_missing_csrf_are_rejected(self):
        self.signup(self.client, "valid@example.com")
        response = self.create_order(self.client, quantity=31)
        self.assertEqual(response.status_code, 400)
        self.assertIn("quantidade", response.get_json()["error"].lower())

        response = self.create_order(self.client, addonIds=["unknown"])
        self.assertEqual(response.status_code, 400)

        response = self.client.post("/api/orders", json=self.order_payload())
        self.assertEqual(response.status_code, 403)

    def test_customers_only_see_their_orders_and_operator_can_advance_them(self):
        first_client = self.app.test_client()
        second_client = self.app.test_client()
        operator_client = self.app.test_client()
        self.signup(first_client, "first@example.com")
        self.signup(second_client, "second@example.com")
        operator_signup = self.signup(operator_client, "team@example.com", account_type="operator")
        self.assertTrue(operator_signup.get_json()["operatorAccessPending"])

        created = self.create_order(first_client)
        order_id = created.get_json()["id"]
        self.assertEqual(len(first_client.get("/api/orders").get_json()), 1)
        self.assertEqual(second_client.get("/api/orders").get_json(), [])

        unauthorized = second_client.patch(
            f"/api/orders/{order_id}",
            json={"status": "preparing"},
            headers={"X-CSRF-Token": self.csrf(second_client)},
        )
        self.assertEqual(unauthorized.status_code, 403)

        self.set_role("team@example.com", "operator")

        self.assertEqual(operator_client.get("/api/session").get_json()["profile"]["role"], "operator")
        all_orders = operator_client.get("/api/orders").get_json()
        self.assertEqual(len(all_orders), 1)
        advanced = operator_client.patch(
            f"/api/orders/{order_id}",
            json={"status": "preparing", "paymentStatus": "paid"},
            headers={"X-CSRF-Token": self.csrf(operator_client)},
        )
        self.assertEqual(advanced.status_code, 200)
        self.assertEqual(advanced.get_json()["status"], "preparing")
        self.assertEqual(advanced.get_json()["paymentStatus"], "paid")
        ready_at = datetime.fromisoformat(advanced.get_json()["estimatedReadyAt"].replace("Z", "+00:00"))
        self.assertGreater(ready_at, datetime.now(timezone.utc) + timedelta(minutes=19))
        self.assertLess(ready_at, datetime.now(timezone.utc) + timedelta(minutes=21))

    def test_status_cannot_skip_a_stage(self):
        self.signup(self.client, "kitchen-user@example.com")
        order_id = self.create_order(self.client).get_json()["id"]
        self.set_role("kitchen-user@example.com", "operator")
        response = self.client.patch(
            f"/api/orders/{order_id}",
            json={"status": "ready"},
            headers={"X-CSRF-Token": self.csrf(self.client)},
        )
        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
