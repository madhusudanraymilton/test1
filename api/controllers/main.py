from odoo import http
from odoo.http import request

class ApiController(http.Controller):

    @http.route('/api/demo', type='http', auth='public', methods=['GET'])
    def demo(self):
        print("Api is not working")
        return "api is not working"
