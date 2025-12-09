
{
    "name": "Automobile Service Management",
    "version": "1.0",
    "summary": "Manage automobile services and maintenance",
    "description": """
        This module helps in managing automobile services, maintenance schedules, and customer information.
    """,
    "category": "Automotive",
    "author": "Madhusudan Ray",
    "website": "https://www.madhusudanray.com",
    "depends": ["base"],
    "data": [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence_data.xml',   # <- ADD THIS LINE
        'views/menu_items.xml',
        'views/vehicle_views.xml',
        'views/customer_views.xml',
        'views/service_order_views.xml',
        'views/wizard_views.xml',
        'views/website_templates.xml',     # <- ADD THIS
        'views/portal_templates.xml',      # <- ADD THIS
        'report/service_order_report.xml',
        'report/service_order_template.xml',
    ],
    "assets": {
        "web.assets_backend": [

        ],
    },
    "demo": [],
    "application": True,
    "installable": True,
    "auto_install": False,
    "license": "LGPL-3",
}