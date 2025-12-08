/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import {CartManagerMixin} from "@theme_prime/js/core/mixins";
import { QuickViewDialog } from "@theme_prime/js/dialog/quick_view_dialog";
import { } from "@website_sale/snippets/s_add_to_cart/000";


export const tpAddToCartMixin = {
    addToCart(params) {
        if (this.isBuyNow || this._isDefaultCartFLow()) {
            return this._super.apply(this, arguments);
        } else {
            return this._customCartSubmit(params);
        }
    }
}

publicWidget.registry.WebsiteSale.include(Object.assign({}, CartManagerMixin, tpAddToCartMixin, {
    init() {
        this._super(...arguments);
        this.notification = this.bindService("notification");
    },
    _onProductReady(isOnProductPage = false) {
        if (this._isB2bModeEnabled()) {
            this._loggedInNotification();
            return Promise.resolve();
        }
        let isInlineButton = this.$el?.get(0).classList.contains('s_add_to_cart_btn');
        if (isInlineButton) {
            this.isBuyNow = this.el?.dataset?.action === 'buy_now';
        }
        let isComboProduct = this.el.querySelector('.tp-combo-product') || this.el.classList.contains('tp-combo-product');
        if (this._isDefaultCartFLow() || this.isBuyNow || isComboProduct) {
            return this._super.apply(this, arguments);
        }
        // Stupidity at it's very best
        // [TO-DO] repeat code here
        let dialogOptions = { parent: this, isVariantSelector: true, size: 'sm', autoAddCallback: () => this._submitForm() };
        if (isInlineButton) {
            if (!this.rootProduct.product_id) {
                dialogOptions['productTmplId'] = parseInt(this.rootProduct.product_template_id, 10);
            } else {
                dialogOptions['productId'] = this.rootProduct.product_id;
            }
            this.call("dialog", "add", QuickViewDialog, dialogOptions);
            return;
        }
        /*  We assume is qty selector is not present the it will not have the
            variant selector so `variantSelectorNeeded` variable used to indicate
            that should we open custom selector or not.
        */
        const variantSelectorNeeded = !this.$form.find('.js_add_cart_variants').length;
        if (variantSelectorNeeded) {
            const productID = this.$form.find('.product_template_id').val();
            if (productID) {
                dialogOptions['productTmplId'] = parseInt(productID);
            } else {
                dialogOptions['productId'] = this.rootProduct.product_id;
            }
            this.call("dialog", "add", QuickViewDialog, dialogOptions);
            return;
        }
        // [TO-DO] repeat code till here
        return this._submitForm();
    },
    _onConfigured(options, values) {
        if (!options.goToCart && values.dr_is_combo) {
            this._customCartSubmit(values);
            this.$target.trigger("dr_add_to_cart_event");
            return;
        }
        return this._super.apply(this, arguments);
    },
    _submitForm: function() {
        this.$target.trigger("dr_add_to_cart_event");
        return this._super.apply(this, arguments);
    },
    _isDefaultCartFLow: function () {
        return !['side_cart', 'dialog', 'notification'].includes(odoo.dr_theme_config.cart_flow);
    },
}));

publicWidget.registry.AddToCartSnippet.include(Object.assign({}, tpAddToCartMixin));
