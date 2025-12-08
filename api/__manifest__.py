# manifest

{
    "name": "api",
    "version": "1.0",
    "summary": "Book Management with Api Flow overview",
    "category": "Tools",
    "description": "This module manages books and provides an API endpoint for demo purposes.",
    "author": "bdCalling",
    "company": "BdCalling",
    "website": "https://www.bdcalling.com",
    "depends": ["base"],
    "data": [
        "security/ir.model.access.csv",
        "views/books_views.xml",
    ],
    "demo": [],
    "application": True,
    "installable": True,
    "auto_install": False,
}