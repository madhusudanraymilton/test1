/** @odoo-module **/

import '@website_sale_wishlist/js/website_sale_wishlist';
import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";
import { B2bMixin } from "@theme_prime/js/core/mixins";

publicWidget.registry.ProductWishlist.include(Object.assign({}, B2bMixin, {
    events: Object.assign({}, {
        'click .wishlist-section .tp_wish_rm': '_onClicktpRemoveWishlistItem',
        'click .wishlist-section .tp_wish_add': '_onClicktpAddWishlistItem',
    }, publicWidget.registry.ProductWishlist.prototype.events),
    init: function () {
        this._super.apply(this, arguments);
        this.notification = this.bindService("notification");
    },
    willStart: async function () {
        await this._super();
        const res = await $.get('/shop/wishlist', { count: 1 });
        this.wishlistProductIDs = JSON.parse(res);
        sessionStorage.setItem('website_sale_wishlist_product_ids', res);
    },
    _onClicktpAddWishlistItem: function (ev) {
        if (this._isB2bModeEnabled()) {
            this._loggedInNotification();
            return;
        }
        this.$('.wishlist-section .tp_wish_add').addClass('disabled');
        this._tpAddOrMoveWishlistItem(ev).then(() => this.$('.wishlist-section .tp_wish_add').removeClass('disabled'));
    },
    _onClicktpRemoveWishlistItem: function (ev) {
        this._tpRemoveWishlistItem(ev, false);
    },
    _tpAddOrMoveWishlistItem: function (e) {
        const $tpWishlistItem = $(e.currentTarget).parents('.tp-wishlist-item');
        const productID = $tpWishlistItem.data('product-id');

        if ($('#b2b_wish').is(':checked')) {
            return this._addToCart(productID, 1);
        } else {
            const addingDeffered = this._addToCart(productID, 1);
            this._tpRemoveWishlistItem(e, addingDeffered);
            return addingDeffered;
        }
    },
    _tpRemoveWishlistItem: function (e, deferred_redirect) {
        const $tpWishlistItem = $(e.currentTarget).parents('.tp-wishlist-item');
        const productID = $tpWishlistItem.data('product-id');
        const wishID = $tpWishlistItem.data('wish-id');

        rpc('/shop/wishlist/remove/' + wishID).then(() => $tpWishlistItem.hide());

        this.wishlistProductIDs = this.wishlistProductIDs.filter((p) => p !== productID);
        sessionStorage.setItem('website_sale_wishlist_product_ids', JSON.stringify(this.wishlistProductIDs));
        if (this.wishlistProductIDs.length === 0) {
            if (deferred_redirect) {
                deferred_redirect.then(() => this._redirectNoWish());
            }
        }
        this._updateWishlistView();
    },
    _updateWishlistView: function () {
        this._super.apply(this, arguments);
        const wishlistCount = this.wishlistProductIDs.length;
        $('.tp-wishlist-counter').text(wishlistCount);
    }
}));
