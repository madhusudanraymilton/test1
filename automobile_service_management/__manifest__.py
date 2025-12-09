{
    "name": "Automobile Service Management",
    "version": "19.0.1.0.0",
    "summary": "Manage automobile services and maintenance",
    "description": """
        This module helps in managing automobile services, maintenance schedules, and customer information.
    """,
    "category": "Services/Automotive",
    "author": "Madhusudan Ray",
    "website": "https://www.madhusudanray.com",
    "depends": ["base", "mail", "portal", "website"],
    "data": [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence_data.xml',
        'views/vehicle_views.xml',
        'views/customer_views.xml',
        'views/service_order_views.xml',
        'views/wizard_views.xml',
        'views/menu_items.xml',  # Load menu AFTER views that define actions
        'views/website_templates.xml',
        'views/portal_templates.xml',
        'report/service_order_report.xml',
        'report/service_order_template.xml',
    ],
    "assets": {
        "web.assets_backend": [],
    },
    "demo": [],
    "application": True,
    "installable": True,
    "auto_install": False,
    "license": "LGPL-3",
}