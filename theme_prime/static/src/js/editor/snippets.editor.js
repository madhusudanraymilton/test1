/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import weSnippetEditor from "@website/js/editor/snippets.editor";

weSnippetEditor.SnippetsMenu.optionsTabStructure = [...weSnippetEditor.SnippetsMenu.optionsTabStructure, ["theme-prime-options", _t("Theme Prime Options")]];
