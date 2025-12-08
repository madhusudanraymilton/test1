/** @odoo-module **/

import "@website/js/content/menu";
import { WebsiteRoot } from "@website/js/content/website_root";
import animations from "@website/js/content/snippets.animation";
import publicWidget from "@web/legacy/js/public/public_widget";
import { hasTouch } from "@web/core/browser/feature_detection";
import { SIZES, utils as uiUtils } from "@web/core/ui/ui_service";

const isMobileEnv = uiUtils.getSize() <= SIZES.LG && hasTouch();

document.querySelectorAll("[data-bs-toggle='tooltip']").forEach(el => {
    new Tooltip(el, {
        boundary: document.body,
    });
});

publicWidget.registry.BackToTopButton = animations.Animation.extend({
    selector: ".tp-back-to-top",
    read_events: {
        "click": "_onClick",
    },
    effects: [{
        startEvents: "scroll",
        update: "_onScroll",
    }],
    start: function () {
        this.el.classList.add("d-none");
        return this._super.apply(this, arguments);
    },
    _onScroll: function (scroll) {
        if (!isMobileEnv) {
            if (scroll > 800) {
                this.el.classList.remove("d-none");
            } else {
                this.el.classList.add("d-none");
            }
        }
    },
    _onClick: ev => {
        ev.preventDefault();
        window.scroll({ top: 0, left: 0, behavior: 'smooth' });
    },
});

// Pricelist make selectable
WebsiteRoot.include({
    events: Object.assign({}, WebsiteRoot.prototype.events, {
        "click .dropdown-menu .tp-select-pricelist": "_onClickTpPricelist",
        "change .dropdown-menu .tp-select-pricelist": "_onChangeTpPricelist",
    }),
    _onClickTpPricelist: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    _onChangeTpPricelist: function (ev) {
        window.location = ev.currentTarget.value;
    },
});

// FIX: Affix header glitch on some devices having no footer pages(like checkout page).
publicWidget.registry.StandardAffixedHeader.include({
    _updateHeaderOnScroll: function (scroll) {
        if (!$("#wrapwrap footer").length) {
            this.destroy();
            return;
        }
        this._super(...arguments);
    }
});

publicWidget.registry.FixedHeader.include({
    _updateHeaderOnScroll: function (scroll) {
        if (!$("#wrapwrap footer").length) {
            this.destroy();
            return;
        }
        this._super(...arguments);
    }
});
