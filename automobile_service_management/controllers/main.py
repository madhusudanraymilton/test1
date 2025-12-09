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
            ('partner_id', '=', current_user.partner_id.id)
        ])

        return request.render("automobile_service_management.portal_service_orders", {
            'orders': orders,
        })

    # ------------------------------------------
    # JSON API → Get All Orders
    # ------------------------------------------
    @http.route('/api/service/orders', type='json', auth="user")
    def api_get_orders(self):
        """Public JSON API returning all service orders."""
        orders = request.env['automobile.service.order'].sudo().search([])

        return [
            {
                'id': order.id,
                'name': order.name,
                'vehicle': order.vehicle_id.display_name,
                'customer': order.partner_id.name,
                'total_amount': order.total_amount,
                'state': order.state,
                'date_order': order.date_order.isoformat() if order.date_order else None,
            }
            for order in orders
        ]

    # ------------------------------------------
    # JSON API → Create Service Order (POST)
    # ------------------------------------------
    @http.route('/api/service/order/create', type='json', auth="user", methods=['POST'])
    def api_create_order(self, **payload):
        """Create service order through JSON POST API."""
        try:
            # Payload sample:
            # {
            #   "vehicle_id": 1,
            #   "partner_id": 2,  # Changed from customer_id
            #   "services": [
            #       {"name": "Oil Change", "description": "Full synthetic oil", "qty": 1, "price_unit": 500},
            #       {"name": "Engine Check", "description": "Diagnostic test", "qty": 1, "price_unit": 700}
            #   ]
            # }

            vehicle_id = payload.get("vehicle_id")
            partner_id = payload.get("partner_id") or payload.get("customer_id")  # Support both
            services = payload.get("services", [])

            if not vehicle_id or not partner_id:
                return {"error": "vehicle_id and partner_id are required"}

            # Validate vehicle exists
            vehicle = request.env['automobile.vehicle'].sudo().browse(vehicle_id)
            if not vehicle.exists():
                return {"error": "Vehicle not found"}

            # Validate partner exists
            partner = request.env['res.partner'].sudo().browse(partner_id)
            if not partner.exists():
                return {"error": "Partner not found"}

            # Create the order
            order = request.env['automobile.service.order'].sudo().create({
                'vehicle_id': vehicle_id,
                'partner_id': partner_id,
            })

            # Create service lines
            for line in services:
                request.env['automobile.service.order.line'].sudo().create({
                    'order_id': order.id,
                    'name': line.get("name", "Service"),
                    'description': line.get("description", ""),
                    'qty': line.get("qty", 1.0),
                    'price_unit': line.get("price_unit") or line.get("amount", 0),  # Support both
                })

            return {
                "status": "success",
                "order_id": order.id,
                "order_name": order.name,
                "total_amount": order.total_amount,
            }

        except Exception as e:
            return {"error": str(e)}

    # ------------------------------------------
    # JSON API → Get Single Order Details
    # ------------------------------------------
    @http.route('/api/service/order/<int:order_id>', type='json', auth="user")
    def api_get_order(self, order_id):
        """Get single order details."""
        try:
            order = request.env['automobile.service.order'].sudo().browse(order_id)
            if not order.exists():
                return {"error": "Order not found"}

            return {
                'id': order.id,
                'name': order.name,
                'vehicle': {
                    'id': order.vehicle_id.id,
                    'name': order.vehicle_id.display_name,
                    'license_plate': order.vehicle_id.license_plate,
                },
                'customer': {
                    'id': order.partner_id.id,
                    'name': order.partner_id.name,
                    'email': order.partner_id.email,
                    'phone': order.partner_id.phone,
                },
                'lines': [
                    {
                        'name': line.name,
                        'description': line.description,
                        'qty': line.qty,
                        'price_unit': line.price_unit,
                        'subtotal': line.subtotal,
                    }
                    for line in order.line_ids
                ],
                'total_amount': order.total_amount,
                'state': order.state,
                'date_order': order.date_order.isoformat() if order.date_order else None,
            }

        except Exception as e:
            return {"error": str(e)}