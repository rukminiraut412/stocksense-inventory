import os
import sys

# Make sure the backend directory is in sys.path so that
# `from extensions import db` etc. work from any sub-module.
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from extensions import db
from routes.deliveries import deliveries_bp
from routes.transfers import transfers_bp


def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), "..", "frontend", "templates"),
        static_folder=os.path.join(os.path.dirname(__file__), "..", "frontend", "static"),
    )

    # ---- Config ----
    db_path = os.path.join(os.path.dirname(__file__), "stocksense.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "stocksense-dev-secret"

    # ---- Extensions ----
    db.init_app(app)
    CORS(app)

    # ---- Register API blueprints ----
    app.register_blueprint(deliveries_bp, url_prefix="/api/deliveries")
    app.register_blueprint(transfers_bp, url_prefix="/api/transfers")

    # ---- Products helper endpoints (stub for test seeding) ----
    # The Products team will replace/expand these.
    from models.product import Product
    from models.location import Location, LocationStock

    @app.route("/api/products", methods=["GET"])
    def list_products():
        products = Product.query.all()
        return jsonify([p.to_dict() for p in products])

    @app.route("/api/products", methods=["POST"])
    def create_product():
        data = request.get_json(force=True) or {}
        name = data.get("name")
        sku = data.get("sku")
        current_stock = float(data.get("current_stock", 0))
        if not name or not sku:
            return jsonify({"error": "name and sku are required."}), 400
        if Product.query.filter_by(sku=sku).first():
            return jsonify({"error": "SKU already exists."}), 400
        p = Product(name=name, sku=sku, current_stock=current_stock)
        db.session.add(p)
        db.session.commit()
        return jsonify(p.to_dict()), 201

    @app.route("/api/products/<int:pid>", methods=["GET"])
    def get_product(pid):
        p = db.session.get(Product, pid)
        if not p:
            return jsonify({"error": "Product not found."}), 404
        return jsonify(p.to_dict())

    # ---- Locations helper endpoints ----
    @app.route("/api/locations", methods=["GET"])
    def list_locations():
        locs = Location.query.all()
        result = []
        for loc in locs:
            d = loc.to_dict()
            d["stock_entries"] = [s.to_dict() for s in loc.stock_entries]
            result.append(d)
        return jsonify(result)

    @app.route("/api/locations", methods=["POST"])
    def create_location():
        data = request.get_json(force=True) or {}
        name = data.get("name")
        warehouse = data.get("warehouse", "")
        if not name:
            return jsonify({"error": "name is required."}), 400
        loc = Location(name=name, warehouse=warehouse)
        db.session.add(loc)
        db.session.commit()
        return jsonify(loc.to_dict()), 201

    @app.route("/api/locations/<int:lid>/stock", methods=["POST"])
    def set_location_stock(lid):
        """Set / override stock quantity for a product at a location (for seeding)."""
        loc = db.session.get(Location, lid)
        if not loc:
            return jsonify({"error": "Location not found."}), 404
        data = request.get_json(force=True) or {}
        product_id = data.get("product_id")
        quantity = data.get("quantity")
        if not product_id or quantity is None:
            return jsonify({"error": "product_id and quantity are required."}), 400
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({"error": "Product not found."}), 404
        entry = LocationStock.query.filter_by(
            location_id=lid, product_id=product_id
        ).first()
        if entry:
            entry.quantity = float(quantity)
        else:
            entry = LocationStock(
                location_id=lid, product_id=product_id, quantity=float(quantity)
            )
            db.session.add(entry)
        db.session.commit()
        return jsonify(entry.to_dict()), 200

    # ---- Frontend page routes ----
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/deliveries")
    def deliveries_page():
        return render_template("deliveries/list.html")

    @app.route("/deliveries/create")
    def deliveries_create_page():
        return render_template("deliveries/create.html")

    @app.route("/deliveries/<int:delivery_id>")
    def delivery_detail_page(delivery_id):
        return render_template("deliveries/detail.html", delivery_id=delivery_id)

    @app.route("/transfers")
    def transfers_page():
        return render_template("transfers/list.html")

    @app.route("/transfers/create")
    def transfers_create_page():
        return render_template("transfers/create.html")

    @app.route("/transfers/<int:transfer_id>")
    def transfer_detail_page(transfer_id):
        return render_template("transfers/detail.html", transfer_id=transfer_id)

    # ---- Create tables ----
    with app.app_context():
        import models  # noqa: F401 – ensure all models are registered
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
