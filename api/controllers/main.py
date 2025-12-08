import json
from odoo import http
from odoo.http import request

class APIController(http.Controller):
    _name = 'api.controller'

    @http.route('/api/items', auth='public', website=True, csrf=False, type='json', methods=['POST'])
    def create_item(self, **kw):
        data = request.jsonrequest
        item = request.env['api.item'].sudo().create({
            'name': data.get('name'),
            'description': data.get('description'),
        })
        return {'id': item.id}

    @http.route('/api/items', auth='public', website=True, csrf=False, type='http', methods=['GET'])
    def get_items(self):
        items = request.env['api.item'].sudo().search([])
        data = []
        for item in items:
            data.append({
                'id': item.id,
                'name': item.name,
                'description': item.description,
            })
        return request.make_response(json.dumps(data), headers={'Content-Type': 'application/json'})

    @http.route('/api/items/<int:item_id>', auth='public', website=True, csrf=False, type='http', methods=['GET'])
    def get_item(self, item_id, **kw):
        item = request.env['api.item'].sudo().browse(item_id)
        if not item.exists():
            return request.make_response(json.dumps({'error': 'Item not found'}), headers={'Content-Type': 'application/json'}, status=404)
        data = {
            'id': item.id,
            'name': item.name,
            'description': item.description,
        }
        return request.make_response(json.dumps(data), headers={'Content-Type': 'application/json'})

    @http.route('/api/items/<int:item_id>', auth='public', website=True, csrf=False, type='json', methods=['PUT'])
    def update_item(self, item_id, **kw):
        item = request.env['api.item'].sudo().browse(item_id)
        if not item.exists():
            return {'error': 'Item not found'}
        
        data = request.jsonrequest
        item.write({
            'name': data.get('name', item.name),
            'description': data.get('description', item.description),
        })
        return {'status': 'success'}

    @http.route('/api/items/<int:item_id>', auth='public', website=True, csrf=False, type='json', methods=['DELETE'])
    def delete_item(self, item_id, **kw):
        item = request.env['api.item'].sudo().browse(item_id)
        if not item.exists():
            return {'error': 'Item not found'}
        
        item.unlink()
        return {'status': 'success'}
