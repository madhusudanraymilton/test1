/** @odoo-module **/

import { onMounted, useRef, useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import publicWidget from "@web/legacy/js/public/public_widget";

export class ProductShareDialog extends Dialog {
    static template = "theme_prime.product_share_dialog";
    static props = {
        ...Dialog.props,
        parent: { type: Object, optional: true },
        close: { type: Function, optional: true },
        slots: { type: Object, optional: true },
    };
    static defaultProps = {
        ...Dialog.defaultProps,
        title: _t("Copy Link"),
        size: "md",
        parent: false,
        technical: false,
    };
    setup() {
        super.setup();
        this.contentRef = useRef("content");
        this.inputRef = useRef("input");
        this.state = useState({
            copying: false,
        });
        onMounted(() => {
            this.onClickCopy();
            this.inputRef.el.value = window.location.href;
            this.props.parent.trigger_up("widgets_start_request", {
                $target: $(this.contentRef.el),
            });
        });
    }
    onClickCopy() {
        try {
            browser.navigator.clipboard.writeText(window.location.href);
            this.state.copying = true;
            setTimeout(() => {
                this.state.copying = false;
            }, 1000);
        } catch {
            this.env.services.notification.add(_t("Link copy failed due to permission denied!"), { type: "danger" });
        }
    }
}

publicWidget.registry.ProductShareDialog = publicWidget.Widget.extend({
    selector: ".tp-share-product",
    read_events: {
        "click": "async _onClick",
    },
    /**
     * @private
     * @param  {Event} ev
     */
    _onClick: function (ev) {
        this.call("dialog", "add", ProductShareDialog, { parent: this });
    },
});
