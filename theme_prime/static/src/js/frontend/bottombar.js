/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import animations from "@website/js/content/snippets.animation";

publicWidget.registry.tpBottomBar = animations.Animation.extend({
    selector: '.tp-bottombar-component',
    read_events: {
        'click .tp-drawer-action-btn': '_onClickDrawerActionBtn'
    },
    effects: [{
        startEvents: 'scroll',
        update: '_onScroll',
    }],
    _onScroll: function (scroll) {
        if (odoo.dr_theme_config.json_bottom_bar.show_bottom_bar_on_scroll) {
            this.$target.toggleClass('tp-bottombar-not-visible', scroll + $("body").innerHeight() >= $("body")[0].scrollHeight - 100 || scroll < 100);
        } else {
            this.$target.toggleClass('tp-bottombar-not-visible', scroll + $("body").innerHeight() >= $("body")[0].scrollHeight - 100);
        }
    },
    _onClickDrawerActionBtn: function () {
        this.$('.tp-bottombar-secondary-element').toggleClass('tp-drawer-open');
        this.$target.toggleClass('tp-drawer-is-open');
    },
});
