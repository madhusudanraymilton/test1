/** @odoo-module **/

import { Dialog } from '@web/core/dialog/dialog';
import { Component, onMounted, useRef } from "@odoo/owl";

export class LazyContentDialog extends Component {
    static template = "theme_prime.LazyContentDialog";
    static components = { Dialog };
    static props = {
        title: {
            validate: (m) => {
                return (
                    typeof m === "string" ||
                    (typeof m === "object" && typeof m.toString === "function")
                );
            },
            optional: true,
        },
        body: { type: String, optional: true },
        parent: { type: Object, optional: true },
    };
    setup() {
        super.setup();
        this.contentRef = useRef("content");
        onMounted(() => {
            this.props.parent.trigger_up("widgets_start_request", {
                $target: $(this.contentRef.el),
            });
        });
    }
}
