/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { rpc } from "@web/core/network/rpc";
import publicWidget from "@web/legacy/js/public/public_widget";
import { markup, onWillStart, onMounted, useRef } from "@odoo/owl";

export class QuickViewDialog extends Dialog {
    static template = "theme_prime.quick_view_dialog";
    static props = {
        ...Dialog.props,
        productTmplId: { type: Number, optional: true },
        productId: { type: Number, optional: true },
        isVariantSelector: { type: Boolean, optional: true },
        autoAddCallback: { type: Function, optional: true },
        parent: { type: Object, optional: true },
        close: { type: Function, optional: true },
        slots: { type: Object, optional: true },
    };
    static defaultProps = {
        ...Dialog.defaultProps,
        size: "xl",
        parent: Object,
    };
    setup() {
        super.setup();
        this.markup = markup;
        this.contentRef = useRef("content");
        onWillStart(this.onWillStart);
        onMounted(this.onMounted);
    }
    async onWillStart() {
        const result = await rpc("/theme_prime/get_quick_view_html", {
            options: { product_tmpl_id: this.props.productTmplId, product_id: this.props.productId, variant_selector: this.props.isVariantSelector },
        });
        if (result) {
            this.content = result;
            // We will not open the dialog for the single variant in mini view
            if (this.props.isVariantSelector && ($(result).hasClass("auto-add-product") || $(result).hasClass("tp-product-out-of-stock")) && !$(result).hasClass("tp-combo-product")) {
                this.props.autoAddCallback({ inStock: !$(result).hasClass("tp-product-out-of-stock"), productTmplID: parseInt($(result).get(0).dataset.productTmplId) });
                this.props.close();
            }
        }
    }
    onMounted() {
        $(this.contentRef.el).find("#product_detail").on('dr_add_to_cart_event', ev => {
            this.props.close();
        });
        // TODO: JAT: Use ProductCarouselMixins mixin
        const $carousel = $(this.contentRef.el).find('#o-carousel-product');
        $carousel.addClass('d_shop_product_details_carousel');
        $carousel.find('.carousel-indicators li').on('click', ev => {
            ev.stopPropagation();
            $carousel.carousel($(ev.currentTarget).index());
        });
        $carousel.find('.carousel-control-next').on('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            $carousel.carousel('next');
        });
        $carousel.find('.carousel-control-prev').on('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            $carousel.carousel('prev');
        });
        this.props.parent.trigger_up("widgets_start_request", {
            $target: $(this.contentRef.el),
        });
    }
}

publicWidget.registry.d_product_quick_view = publicWidget.Widget.extend({
    selector: '.tp-product-quick-view-action, .tp_hotspot[data-on-hotspot-click="modal"]',
    read_events: {
        'click': 'async _onClick',
    },
    /**
     * @private
     * @param  {Event} ev
     */
    _onClick: function (ev) {
        this.call("dialog", "add", QuickViewDialog, { parent: this, productTmplId: parseInt($(ev.currentTarget).attr("data-product-id")) });
    },
});
