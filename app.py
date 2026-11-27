import hmac
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import click
from flask import Flask, current_app, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash


PRODUCTS = {
    "frango": ("Frango grelhado", 2490),
    "carne": ("Carne de panela", 2690),
    "vegetariana": ("Marmita vegetariana", 2390),
    "executiva": ("Marmita executiva", 2990),
}
ADDONS = {
    "farofa": ("Farofa", 300),
    "ovo": ("Ovo", 250),
    "bacon": ("Bacon", 400),
}
CUSTOMIZATIONS = {"Sem feijão", "Sem salada", "Trocar salada por farofa"}
STATUSES = ("waiting", "preparing", "ready", "delivering", "completed")
PAYMENT_METHODS = {"pix", "cash", "card"}
FULFILLMENT_METHODS = {"delivery", "pickup"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0)


def isoformat(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def create_app(test_config=None):
    application = Flask(__name__, static_folder="dist", static_url_path="")
    configured_secret = os.environ.get("SECRET_KEY")
    if not configured_secret and os.environ.get("RENDER"):
        raise RuntimeError("Configure a persistent SECRET_KEY before starting the production server.")
    application.config.update(
        SECRET_KEY=configured_secret or secrets.token_urlsafe(32),
        DATABASE_PATH=os.environ.get(
            "DATABASE_PATH",
            str(Path(application.root_path) / "instance" / "marmita.sqlite3"),
        ),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "").lower() == "true",
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    if test_config:
        application.config.update(test_config)
    if application.config.get("TESTING"):
        application.config["SESSION_COOKIE_SECURE"] = False

    initialize_database(application)

    @application.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @application.errorhandler(413)
    def request_too_large(_error):
        return json_error("A solicitação ultrapassa o tamanho permitido.", 413)

    @application.teardown_appcontext
    def close_database(_error=None):
        connection = g.pop("database", None)
        if connection is not None:
            connection.close()

    def json_error(message, status):
        return jsonify({"error": message}), status

    def csrf_is_valid():
        token = session.get("csrf_token", "")
        supplied = request.headers.get("X-CSRF-Token", "")
        return bool(token and supplied and hmac.compare_digest(token, supplied))

    def require_csrf(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not csrf_is_valid():
                return json_error("A sessão expirou. Atualize a página e tente novamente.", 403)
            return view(*args, **kwargs)
        return wrapped

    def require_user(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user_id = session.get("user_id")
            if not user_id:
                return json_error("Entre na sua conta para continuar.", 401)
            user = get_database().execute(
                "SELECT id, email, full_name, phone, role FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if user is None:
                session.clear()
                return json_error("Sua sessão não é mais válida. Entre novamente.", 401)
            g.user = user
            return view(*args, **kwargs)
        return wrapped

    def require_operator(view):
        @wraps(view)
        @require_user
        def wrapped(*args, **kwargs):
            if g.user["role"] != "operator":
                return json_error("Somente a equipe da cozinha pode fazer isso.", 403)
            return view(*args, **kwargs)
        return wrapped

    def user_json(user):
        return {
            "id": str(user["id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "phone": user["phone"],
            "role": user["role"],
        }

    def operator_request_pending(user_id):
        row = get_database().execute(
            "SELECT status FROM operator_access_requests WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return bool(row and row["status"] == "pending")

    def order_json(row):
        addon_ids = json.loads(row["addon_ids"])
        return {
            "id": str(row["id"]),
            "number": row["id"],
            "createdAt": row["created_at"],
            "customer": {
                "id": str(row["customer_id"]) if row["customer_id"] is not None else f"walk-in-{row['id']}",
                "name": row["customer_name"],
                "phone": row["customer_phone"],
                "address": row["delivery_address"],
            },
            "product": {
                "id": row["product_id"],
                "name": row["product_name"],
                "priceCents": row["product_price_cents"],
            },
            "quantity": row["quantity"],
            "customizations": json.loads(row["customizations"]),
            "extras": [
                {"id": addon_id, "name": ADDONS[addon_id][0], "priceCents": ADDONS[addon_id][1]}
                for addon_id in addon_ids
            ],
            "notes": row["notes"],
            "fulfillment": row["fulfillment"],
            "paymentMethod": row["payment_method"],
            "paymentStatus": row["payment_status"],
            "totalCents": row["total_cents"],
            "status": row["status"],
            "estimatedReadyAt": row["estimated_ready_at"],
        }

    def get_order(order_id):
        return get_database().execute(
            """SELECT orders.*, menu_products.name AS product_name,
                      menu_products.price_cents AS product_price_cents
               FROM orders
               JOIN menu_products ON menu_products.id = orders.product_id
               WHERE orders.id = ?""",
            (order_id,),
        ).fetchone()

    @application.get("/api/session")
    def get_session():
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        user = None
        if session.get("user_id"):
            user = get_database().execute(
                "SELECT id, email, full_name, phone, role FROM users WHERE id = ?",
                (session["user_id"],),
            ).fetchone()
            if user is None:
                session.clear()
                session["csrf_token"] = secrets.token_urlsafe(32)
        return jsonify({
            "authenticated": user is not None,
            "profile": user_json(user) if user is not None else None,
            "operatorAccessPending": operator_request_pending(user["id"]) if user is not None else False,
            "csrfToken": session["csrf_token"],
        })

    @application.post("/api/auth/signup")
    @require_csrf
    def signup():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return json_error("Envie os dados da conta em formato válido.", 400)
        full_name = data.get("fullName")
        phone = data.get("phone")
        email = data.get("email")
        password = data.get("password")
        account_type = data.get("accountType", "customer")
        if not isinstance(full_name, str) or not full_name.strip() or len(full_name.strip()) > 100:
            return json_error("Informe um nome com até 100 caracteres.", 400)
        if not isinstance(phone, str) or not phone.strip() or len(phone.strip()) > 30:
            return json_error("Informe um telefone válido.", 400)
        if not isinstance(email, str) or not EMAIL_PATTERN.fullmatch(email.strip()) or len(email) > 254:
            return json_error("Informe um e-mail válido.", 400)
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            return json_error("A senha precisa ter de 8 a 128 caracteres.", 400)
        if account_type not in ("customer", "operator"):
            return json_error("O tipo de acesso solicitado não é válido.", 400)
        normalized_email = email.strip().lower()
        database = get_database()
        try:
            created_at = isoformat(utc_now())
            cursor = database.execute(
                """INSERT INTO users (email, password_hash, full_name, phone, role, created_at)
                   VALUES (?, ?, ?, ?, 'customer', ?)""",
                (normalized_email, generate_password_hash(password), full_name.strip(), phone.strip(), created_at),
            )
            if account_type == "operator":
                database.execute(
                    "INSERT INTO operator_access_requests (user_id, requested_at) VALUES (?, ?)",
                    (cursor.lastrowid, created_at),
                )
            database.commit()
        except sqlite3.IntegrityError:
            database.rollback()
            return json_error("Já existe uma conta com este e-mail.", 409)
        user = database.execute(
            "SELECT id, email, full_name, phone, role FROM users WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        session.clear()
        session["user_id"] = user["id"]
        session["csrf_token"] = secrets.token_urlsafe(32)
        session.permanent = True
        return jsonify({
            "profile": user_json(user),
            "csrfToken": session["csrf_token"],
            "operatorAccessPending": account_type == "operator",
        }), 201

    @application.post("/api/auth/login")
    @require_csrf
    def login():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return json_error("Envie e-mail e senha em formato válido.", 400)
        email = data.get("email")
        password = data.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            return json_error("Informe o e-mail e a senha.", 400)
        user = get_database().execute(
            "SELECT id, email, password_hash, full_name, phone, role FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
        if user is None or not check_password_hash(user["password_hash"], password):
            return json_error("E-mail ou senha incorretos.", 401)
        session.clear()
        session["user_id"] = user["id"]
        session["csrf_token"] = secrets.token_urlsafe(32)
        session.permanent = True
        return jsonify({
            "profile": user_json(user),
            "csrfToken": session["csrf_token"],
            "operatorAccessPending": operator_request_pending(user["id"]),
        })

    @application.post("/api/auth/logout")
    @require_csrf
    def logout():
        session.clear()
        return jsonify({"ok": True})

    @application.get("/api/orders")
    @require_user
    def list_orders():
        database = get_database()
        if g.user["role"] == "operator":
            rows = database.execute(
                """SELECT orders.*, menu_products.name AS product_name,
                          menu_products.price_cents AS product_price_cents
                   FROM orders
                   JOIN menu_products ON menu_products.id = orders.product_id
                   ORDER BY orders.created_at DESC, orders.id DESC"""
            ).fetchall()
        else:
            rows = database.execute(
                """SELECT orders.*, menu_products.name AS product_name,
                          menu_products.price_cents AS product_price_cents
                   FROM orders
                   JOIN menu_products ON menu_products.id = orders.product_id
                   WHERE orders.customer_id = ?
                   ORDER BY orders.created_at DESC, orders.id DESC""",
                (g.user["id"],),
            ).fetchall()
        return jsonify([order_json(row) for row in rows])

    @application.post("/api/orders")
    @require_csrf
    @require_user
    def create_order():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return json_error("Envie o pedido em formato válido.", 400)
        customer = data.get("customer") if isinstance(data.get("customer"), dict) else {}
        product_id = data.get("productId")
        quantity = data.get("quantity")
        customizations = data.get("customizations", [])
        addon_ids = data.get("addonIds", [])
        fulfillment = data.get("fulfillment")
        payment_method = data.get("paymentMethod")
        notes = data.get("notes", "")

        if not isinstance(product_id, str) or product_id not in PRODUCTS:
            return json_error("Escolha uma marmita disponível.", 400)
        if type(quantity) is not int or not 1 <= quantity <= 30:
            return json_error("A quantidade deve ser de 1 a 30 marmitas.", 400)
        if not isinstance(customizations, list) or any(not isinstance(item, str) or item not in CUSTOMIZATIONS for item in customizations):
            return json_error("Revise as personalizações escolhidas.", 400)
        if len(set(customizations)) != len(customizations):
            return json_error("Há personalizações repetidas.", 400)
        if not isinstance(addon_ids, list) or any(not isinstance(item, str) or item not in ADDONS for item in addon_ids):
            return json_error("Um acompanhamento escolhido não está disponível.", 400)
        if len(set(addon_ids)) != len(addon_ids):
            return json_error("Há acompanhamentos repetidos.", 400)
        if not isinstance(fulfillment, str) or fulfillment not in FULFILLMENT_METHODS:
            return json_error("Escolha entrega ou retirada.", 400)
        if not isinstance(payment_method, str) or payment_method not in PAYMENT_METHODS:
            return json_error("Escolha uma forma de pagamento válida.", 400)
        if not isinstance(notes, str) or len(notes) > 500:
            return json_error("A observação deve ter até 500 caracteres.", 400)

        if g.user["role"] == "customer":
            customer_id = g.user["id"]
            customer_name = g.user["full_name"]
            customer_phone = g.user["phone"]
        else:
            customer_name = customer.get("name")
            customer_phone = customer.get("phone")
            customer_id = None
            linked_id = data.get("customerId")
            if linked_id not in (None, ""):
                try:
                    linked_id = int(linked_id)
                except (TypeError, ValueError):
                    return json_error("O cliente selecionado não é válido.", 400)
                linked = get_database().execute(
                    "SELECT id FROM users WHERE id = ? AND role = 'customer'",
                    (linked_id,),
                ).fetchone()
                if linked is None:
                    return json_error("O cliente selecionado não foi encontrado.", 404)
                customer_id = linked["id"]
            if not isinstance(customer_name, str) or not customer_name.strip() or len(customer_name.strip()) > 100:
                return json_error("Informe o nome do cliente.", 400)
            if not isinstance(customer_phone, str) or not customer_phone.strip() or len(customer_phone.strip()) > 30:
                return json_error("Informe o telefone do cliente.", 400)
            customer_name = customer_name.strip()
            customer_phone = customer_phone.strip()

        address = customer.get("address", "")
        if not isinstance(address, str) or len(address) > 300:
            return json_error("O endereço deve ter até 300 caracteres.", 400)
        address = address.strip() if fulfillment == "delivery" else ""
        if fulfillment == "delivery" and not address:
            return json_error("Informe o endereço de entrega.", 400)

        product_name, product_price = PRODUCTS[product_id]
        addons_price = sum(ADDONS[addon_id][1] for addon_id in addon_ids)
        total_cents = (product_price + addons_price) * quantity
        created_at = utc_now()
        eta = created_at + timedelta(minutes=35)
        payment_status = data.get("paymentStatus") if g.user["role"] == "operator" else "pending"
        if payment_status not in ("paid", "pending"):
            return json_error("Escolha a situação do pagamento.", 400)
        database = get_database()
        cursor = database.execute(
            """INSERT INTO orders (
                   customer_id, created_by, customer_name, customer_phone, delivery_address,
                   product_id, quantity, customizations, addon_ids, notes, fulfillment,
                   payment_method, payment_status, status, total_cents, estimated_ready_at,
                   created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)""",
            (
                customer_id,
                g.user["id"],
                customer_name,
                customer_phone,
                address,
                product_id,
                quantity,
                json.dumps(list(dict.fromkeys(customizations))),
                json.dumps(list(dict.fromkeys(addon_ids))),
                notes.strip(),
                fulfillment,
                payment_method,
                payment_status,
                total_cents,
                isoformat(eta),
                isoformat(created_at),
                isoformat(created_at),
            ),
        )
        database.commit()
        return jsonify(order_json(get_order(cursor.lastrowid))), 201

    @application.patch("/api/orders/<int:order_id>")
    @require_csrf
    @require_operator
    def update_order(order_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return json_error("Envie as alterações em formato válido.", 400)
        row = get_order(order_id)
        if row is None:
            return json_error("Pedido não encontrado.", 404)
        updates = {}
        if "status" in data:
            next_status = data["status"]
            if next_status not in STATUSES:
                return json_error("A etapa do pedido não é válida.", 400)
            current_index = STATUSES.index(row["status"])
            allowed = STATUSES[current_index + 1] if current_index < len(STATUSES) - 1 else None
            if row["status"] == "ready" and row["fulfillment"] == "pickup":
                allowed = "completed"
            if next_status != row["status"] and next_status != allowed:
                return json_error("Avance o pedido pela próxima etapa da fila.", 409)
            updates["status"] = next_status
            if next_status != row["status"]:
                if next_status == "preparing":
                    updates["estimated_ready_at"] = isoformat(utc_now() + timedelta(minutes=20))
                elif next_status in ("ready", "delivering", "completed"):
                    updates["estimated_ready_at"] = isoformat(utc_now())
        if "paymentStatus" in data:
            if data["paymentStatus"] not in ("paid", "pending"):
                return json_error("A situação do pagamento não é válida.", 400)
            updates["payment_status"] = data["paymentStatus"]
        if "estimatedReadyAt" in data:
            try:
                eta = datetime.fromisoformat(str(data["estimatedReadyAt"]).replace("Z", "+00:00"))
                if eta.tzinfo is None:
                    raise ValueError
                if eta > utc_now() + timedelta(days=30):
                    return json_error("A previsão não pode ultrapassar 30 dias.", 400)
                updates["estimated_ready_at"] = isoformat(eta)
            except (TypeError, ValueError):
                return json_error("A previsão de preparo não é válida.", 400)
        if not updates:
            return json_error("Informe uma alteração para salvar.", 400)

        updates["updated_at"] = isoformat(utc_now())
        assignments = ", ".join(f"{column} = ?" for column in updates)
        get_database().execute(
            f"UPDATE orders SET {assignments} WHERE id = ?",
            (*updates.values(), order_id),
        )
        get_database().commit()
        return jsonify(order_json(get_order(order_id)))

    @application.get("/")
    def index():
        return send_from_directory(application.static_folder, "index.html")

    @application.cli.command("promote-operator")
    @click.argument("email")
    def promote_operator(email):
        """Grant kitchen access to an existing account (administrator only)."""
        cursor = get_database().execute(
            "UPDATE users SET role = 'operator' WHERE email = ?",
            (email.strip().lower(),),
        )
        if cursor.rowcount == 1:
            get_database().execute(
                """UPDATE operator_access_requests
                   SET status = 'approved', resolved_at = ?
                   WHERE user_id = (SELECT id FROM users WHERE email = ?)""",
                (isoformat(utc_now()), email.strip().lower()),
            )
        get_database().commit()
        if cursor.rowcount != 1:
            raise click.ClickException("Conta não encontrada. Crie a conta antes de habilitar o acesso.")
        click.echo(f"Acesso da equipe habilitado para {email.strip().lower()}.")

    return application


def get_database():
    if "database" not in g:
        database_path = Path(current_app.config["DATABASE_PATH"])
        if str(database_path) != ":memory:":
            database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(database_path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.database = connection
    return g.database

def initialize_database(application):
    database_path = Path(application.config["DATABASE_PATH"])
    if str(database_path) != ":memory:":
        database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(database_path))
    try:
        schema_path = Path(application.root_path) / "schema.sql"
        connection.executescript(schema_path.read_text(encoding="utf-8"))
        connection.executemany(
            "INSERT OR IGNORE INTO menu_products (id, name, price_cents) VALUES (?, ?, ?)",
            [(key, name, price) for key, (name, price) in PRODUCTS.items()],
        )
        connection.executemany(
            "INSERT OR IGNORE INTO menu_addons (id, name, price_cents) VALUES (?, ?, ?)",
            [(key, name, price) for key, (name, price) in ADDONS.items()],
        )
        connection.commit()
    finally:
        connection.close()


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG") == "1")
