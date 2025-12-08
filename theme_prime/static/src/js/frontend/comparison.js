/** @odoo-module **/

import ProductComparison from '@website_sale_comparison/js/website_sale_comparison';
import publicWidget from "@web/legacy/js/public/public_widget";
import { B2bMixin } from "@theme_prime/js/core/mixins";

ProductComparison.include(Object.assign({}, {
    // nothing in comparsion fix added in theme prime v17.0
    _loadProducts: function (products) {
        if (products.length) {
            return this._super.apply(this, arguments);
        }
        return Promise.resolve();
    },
}));

publicWidget.registry.ProductComparison.include(Object.assign({}, B2bMixin, {
    selector: '#wrap', // changed selector
    events: Object.assign({
        'click .d_product_comparison': '_onClickCompareBtn',
    }, publicWidget.registry.ProductComparison.prototype.events),
    init: function () {
        this._super.apply(this, arguments);
        this.notification = this.bindService("notification");
    },
    /**
     * @override
     */
    start: function () {
        let defs = [];

        // Right now we are calling super if #wrap contains .tp-droggol-18-builder-snippet
        // For V15 we only call super if wishlist feature is enabled for snippet.

        // var comparisonEnabled = false;
        // var $snippets = this.$('.tp-droggol-18-builder-snippet[data-user-params]');
        // _.each($snippets, function (snippet) {
        //     var $snippet = $(snippet);
        //     var userParams = $snippet.attr('data-user-params');
        //     userParams = userParams ? JSON.parse(userParams) : false;
        //     if (userParams && userParams.comparison) {
        //         comparisonEnabled = true;
        //     }
        // });
        if (this.$('.tp-droggol-18-builder-snippet').length || this.$target.hasClass('oe_website_sale') || this.$('.oe_website_sale').length) {
            defs.push(this._super.apply(this, arguments));
        }
        return Promise.all(defs);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onClickCompareBtn: function (ev) {
        if (this.productComparison.comparelist_product_ids.length < this.productComparison.product_compare_limit) {
            this.productComparison._addNewProducts(parseInt($(ev.currentTarget).get(0).dataset.productProductId));
        } else {
            this.productComparison.$el.find('.o_comparelist_limit_warning').show();
            $('#comparelist .o_product_panel_header').popover('show');
        }
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onFormSubmit(ev) {
        ev.preventDefault();
        if (this._isB2bModeEnabled()) {
            this._loggedInNotification();
            return;
        }
        this._super.apply(this, arguments);
    },
}));
