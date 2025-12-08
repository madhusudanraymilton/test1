/** @odoo-module **/

import { utils as uiUtils } from "@web/core/ui/ui_service";
import RootWidget from "@theme_prime/js/core/snippet_root_widget";
import { QuickViewDialog } from "@theme_prime/js/dialog/quick_view_dialog";
import { rpc } from "@web/core/network/rpc";
import { cartMixin, CartManagerMixin , MarkupRecords} from "@theme_prime/js/core/mixins";
import { intersection } from "@web/core/utils/arrays";
import { renderToString } from "@web/core/utils/render";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";

export default RootWidget.extend(cartMixin, CartManagerMixin, MarkupRecords, {

    snippetNodeAttrs: (RootWidget.prototype.snippetNodeAttrs || []).concat(['data-ui-config-info', 'data-extra-info']),
    tpFieldsToMarkUp: ['price', 'rating', 'list_price', 'label_template', 'dr_stock_label', 'colors', 'description_ecommerce', 'short_description'],

    read_events: Object.assign({
        'click .d_add_to_cart_btn': '_onAddToCartClick',
        'click .d_add_to_wishlist_btn': '_onAddToWishlistClick',
        'click .d_product_quick_view': '_onProductQuickViewClick'
    }, RootWidget.prototype.read_events),

    init() {
        this._super(...arguments);
        this.wishlistProductIDs = [];
        this.imageFill = odoo?.dr_theme_config?.json_shop_product_item?.image_fill;
        this.imageSize = odoo?.dr_theme_config?.json_shop_product_item?.image_size;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
    * @private
    */
    _getOptions: function () {
        let options = {};
        if (this.selectionInfo && this.selectionInfo.model) {
            options['model'] = this.selectionInfo.model;
        }
        // add new attribute to widget or just set data-userParams to $target
        if (this.uiConfigInfo) {
            if (this._isActionEnabled('wishlist')) {
                options['wishlist_enabled'] = true;
            }
            // fetch shop config only if 'wishlist', 'comparison', 'rating'
            // any one of this is enabled in current snippet
            if (this._anyActionEnabled(this._getMustDisabledOptions())) {
                options['shop_config_params'] = true;
            }
            return options;
        } else {
            let _sup = this._super.apply(this, arguments);
            return Object.keys(options).length !== 0 ? options : _sup;
        }
    },
    /**
    * Check any given option is enabled(true) in userParams.
    * e.g. this.uiConfigInfo.wishlist = true;
    * this method return true if any one of given option is true
    * @private
    */
    _anyActionEnabled: function (actions) {
        return intersection(actions, this.uiConfigInfo.activeActions).length >= 1;
    },
    /**
     * @private
     */
    _getAllActions: function () {
        return ['wishlist', 'comparison', 'add_to_cart', 'quick_view'];
    },
    /**
    * @private
    * @see _getMustDisabledOptions of configurator
    */
    _getMustDisabledOptions: function () {
        return ['wishlist', 'comparison', 'rating'];
    },
    /**
     * init tooltips
     *
     * @private
     */
    _initTips: function () {
        this.$('[data-bs-toggle="tooltip"]').tooltip();
    },
    /**
     * @private
     */
    _isActionEnabled: function (actionName, actions) {
        let allActions = actions || this.uiConfigInfo.activeActions;
        return allActions.includes(actionName);
    },
    /**
     * @override
     */
    _modifyElementsAfterAppend: function () {
        this._initTips();
        this.wishlistProductIDs.forEach(id => {
            this.$('.d_add_to_wishlist_btn[data-product-product-id="' + id + '"]').prop("disabled", true).addClass('disabled');
        });
        // [HACK] must be improve in next version.
        // Dev like it will work on both (shop and snippet)
        // Also in snippet only show similar_products buttons if similar_products exist
        this._reloadWidget({ selector: '.tp_show_similar_products'})
        this._reloadWidget({ selector: '.tp-product-preview-swatches'})
        this._super.apply(this, arguments);
    },
    /**
     * @private
     */
    _updateUserParams: function (shopConfigParams) {
        if (this.uiConfigInfo) {
            this._getMustDisabledOptions().forEach(option => {
                let enabledInShop = shopConfigParams['is_' + option + '_active'];
                if (!enabledInShop) {
                    this.uiConfigInfo['activeActions'] = this.uiConfigInfo.activeActions.filter((x) => x !== option);
                }
            });
            // whether need to render whole container for
            // e.g if all actions are disabled then donot render overlay(contains add to card, wishlist btns etc)
            this.uiConfigInfo['anyActionEnabled'] = this._anyActionEnabled(this._getAllActions());
        }
    },
    /**
    * Method is copy of wishlist public widget
    *
    * @private
    */
    _updateWishlistView: function () {
        const $wishButton = $('.o_wsale_my_wish');
        if ($wishButton.hasClass('o_wsale_my_wish_hide_empty')) {
            $wishButton.toggleClass('d-none', !this.wishlistProductIDs.length);
        }
        $wishButton.find('.my_wish_quantity').text(this.wishlistProductIDs.length);
        if (this.wishlistProductIDs.length > 0) {
            $wishButton.show();
            $('.my_wish_quantity').text(this.wishlistProductIDs.length);
        } else {
            $wishButton.show();
            $('.my_wish_quantity').text('');
        }
    },
    /**
    * @private
    */
    _setDBData: function (data) {
        if (data.wishlist_products) {
            this.wishlistProductIDs = data.wishlist_products;
        }
        if (data.shop_config_params) {
            this.shopConfig = data.shop_config_params;
            this._updateUserParams(data.shop_config_params);
        }
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param  {Event} ev
     */
    _onAddToCartClick: function (ev) {
        this.onAddToCartClick(ev);
    },
    /**
     * @private
     * @param  {Event} ev
     */
    _onProductQuickViewClick: function (ev) {
        this.call("dialog", "add", QuickViewDialog, { parent: this, productTmplId: parseInt($(ev.currentTarget).attr('data-product-template-id')), productId: parseInt($(ev.currentTarget).attr('data-product-product-id')) });
    },
    /**
    * @private
    */
    _removeProductFromWishlist: function (wishlistID, productID) {
        rpc('/shop/wishlist/remove/' + wishlistID).then(() => {
            // I hate $
            let className = `.tp-notification.${productID}`;
            $(className).addClass('d-none');
            $(".d_add_to_wishlist_btn[data-product-product-id='" + productID + "']").prop("disabled", false).removeClass('disabled');
            this.wishlistProductIDs = this.wishlistProductIDs.filter(id => id !== productID);
            this._updateWishlistView();
        });
    },
    displayNotification: function (data) {
        this.notification.add(data.message, data);
    },
    /**
     * @private
     * @param  {Event} ev
     */
    _onAddToWishlistClick: function (ev) {
        let productID = parseInt($(ev.currentTarget).attr('data-product-product-id'));
        rpc('/theme_prime/wishlist_general', { product_id: productID }).then(res => {
            this.wishlistProductIDs = res.products;
            this.displayNotification({
                className: `tp-notification tp-bg-soft-danger ${productID}`,
                templateToUse: 'theme_prime.NotificationGeneric',
                message: markup(renderToString('DroggolNotification', {color: 'danger', productName: res.name, message: _t('Added to your wishlist.'), iconClass: 'dri dri-wishlist'})),
                buttons: [{name: _t("Wishlist"), onClick: () => {window.location = '/shop/wishlist';}}, { name: _t("Undo"), onClick: () => { this._removeProductFromWishlist(res.wishlist_id, productID);}}],
            });
            this._updateWishlistView();
            $(".d_add_to_wishlist_btn[data-product-product-id='" + productID + "']").prop("disabled", true).addClass('disabled');
        });
    },
    _processData: function (data) {
        if (data.products) {
            this._markUpValues(this.tpFieldsToMarkUp, data.products);
        }
        return data;
    },
    _cleanBeforeAppend: function () {
        if (this.uiConfigInfo && this.uiConfigInfo.mode === 'grid') {
            this._setClass();
        }
    },
    _onWindowResize: function () {
        this._super.apply(this, arguments);
        // Added this.response bcoz odoo is triggering resize from many places and this is totally shit for ex comparison
        // due to this no data template append first sometimes
        if (this.uiConfigInfo && this.uiConfigInfo.mode === 'grid' && this.response && !this.editableMode) {
            this._setClass();
            this._onSuccessResponse(this.response);
        }
    },
    _onSuccessResponse: function () {
        if (this.isMobile && this.uiConfigInfo && this.uiConfigInfo.mobileConfig) {
            let keys = Object.keys(this.uiConfigInfo.mobileConfig);
            keys.forEach((key) => {
                if (this.uiConfigInfo[key] && this.uiConfigInfo.mobileConfig[key] === 'default') {
                    this.uiConfigInfo.mobileConfig[key] = this.uiConfigInfo[key];
                }
            });
            this.uiConfigInfo = { ... this.uiConfigInfo, ... this.uiConfigInfo.mobileConfig };
        }
        this._super.apply(this, arguments);
    },
    _setClass: function () {
        this.deviceSizeClass = uiUtils.getSize();
        if (this.deviceSizeClass <= 1) {
            this.cardSize = 12;
            if (this.uiConfigInfo_init && this.uiConfigInfo_init.mobileConfig && this.uiConfigInfo_init.mobileConfig.style !== 'default' && this.uiConfigInfo.mobileConfig && this.uiConfigInfo.mobileConfig.mode === 'grid') {
                this.cardSize = 6;
            }
            this.cardColClass = 'col-' + this.cardSize.toString();
        } else if (this.deviceSizeClass === 2) {
            this.cardSize = 6;
            this.cardColClass = 'col-sm-' + this.cardSize.toString();
        } else if (this.deviceSizeClass === 3 || this.deviceSizeClass === 4) {
            this.cardSize = 4;
            this.cardColClass = 'col-md-' + this.cardSize.toString();
        } else if (this.deviceSizeClass >= 5) {
            this.cardSize = parseInt(12 / this.uiConfigInfo.ppr);
            this.cardColClass = 'col-lg-' + this.cardSize.toString();
        }
    }
});
