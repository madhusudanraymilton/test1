from odoo import http
from odoo.http import request
import json


class AutomobileServiceController(http.Controller):

    # ------------------------------------------
    # WEBSITE ROUTE (Public Page)
    # ------------------------------------------
    @http.route('/automobile/service', type='http', auth="public", website=True)
    def automobile_service_home(self, **kw):
        """Simple website page showing service orders."""
        orders = request.env['automobile.service.order'].sudo().search([])
        return request.render("automobile_service_management.website_service_list", {
            'orders': orders,
        })

    # ------------------------------------------
    # PORTAL ROUTE (Portal / Logged-in users)
    # ------------------------------------------
    @http.route('/my/service/orders', type='http', auth="user", website=True)
    def portal_service_orders(self, **kw):
        """Portal users see only their own orders."""
        current_user = request.env.user

        orders = request.env['automobile.service.order'].sudo().search([
            ('customer_id.email', '=', current_user.email)
        ])

        return request.render("automobile_service_management.portal_service_orders", {
            'orders': orders,
        })

    # ------------------------------------------
    # JSON API → Get All Orders
    # ------------------------------------------
    @http.route('/api/service/orders', type='json', auth="public")
    def api_get_orders(self):
        """Public JSON API returning all service orders."""
        orders = request.env['automobile.service.order'].sudo().search([])

        return [
            {
                'name': order.name,
                'vehicle': order.vehicle_id.name,
                'customer': order.customer_id.name,
                'total_amount': order.total_amount,
                'state': order.state,
            }
            for order in orders
        ]

    # ------------------------------------------
    # JSON API → Create Service Order (POST)
    # ------------------------------------------
    @http.route('/api/service/order/create', type='json', auth="public", methods=['POST'])
    def api_create_order(self, **payload):
        """Create service order through JSON POST API."""
        try:
            # Payload sample:
            # {
            #   "vehicle_id": 1,
            #   "customer_id": 2,
            #   "services": [
            #       {"description": "Oil Change", "amount": 500},
            #       {"description": "Engine Check", "amount": 700}
            #   ]
            # }

            vehicle_id = payload.get("vehicle_id")
            customer_id = payload.get("customer_id")
            services = payload.get("services", [])

            if not vehicle_id or not customer_id:
                return {"error": "vehicle_id and customer_id are required"}

            # Create the order
            order = request.env['automobile.service.order'].sudo().create({
                'vehicle_id': vehicle_id,
                'customer_id': customer_id,
            })

            # Create service lines
            for line in services:
                request.env['automobile.service.order.line'].sudo().create({
                    'order_id': order.id,
                    'description': line.get("description"),
                    'amount': line.get("amount", 0),
                })

            order._compute_total_amount()

            return {
                "status": "success",
                "order_id": order.id,
                "order_name": order.name,
            }

        except Exception as e:
            return {"error": str(e)}
