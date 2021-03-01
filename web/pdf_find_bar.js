/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FindState } from "./pdf_find_controller.js";
import { NullL10n } from "./ui_utils.js";
import { parseQueryString } from "./ui_utils.js";

const MATCHES_COUNT_LIMIT = 1000;

/**
 * Creates a "search bar" given a set of DOM elements that act as controls
 * for searching or for setting search preferences in the UI. This object
 * also sets up the appropriate events for the controls. Actual searching
 * is done by PDFFindController.
 */
class PDFFindBar {
  constructor(options, eventBus, l10n = NullL10n) {
    console.log('PDFFindBar start');
    this.opened = false;

    this.bar = options.bar || null;
    this.toggleButton = options.toggleButton || null;
    this.findField = options.findField || null;
    this.highlightAll = options.highlightAllCheckbox || null;
    this.caseSensitive = options.caseSensitiveCheckbox || null;
    this.entireWord = options.entireWordCheckbox || null;
    this.findMsg = options.findMsg || null;
    this.findResultsCount = options.findResultsCount || null;
    this.findPreviousButton = options.findPreviousButton || null;
    this.findNextButton = options.findNextButton || null;
    this.saveButton = options.saveButton || null;
    this.multiFindPreviousButton = options.multiFindPreviousButton || null;
    this.multiFindNextButton = options.multiFindNextButton || null;
    this.eventBus = eventBus;
    this.l10n = l10n;

    // Add event listeners to the DOM elements.
    this.toggleButton.addEventListener("click", () => {
      this.toggle();
    });

    this.findField.addEventListener("input", () => {
      this.dispatchEvent("");
    });

    this.bar.addEventListener("keydown", e => {
      switch (e.keyCode) {
        case 13: // Enter
          if (e.target === this.findField) {
            this.dispatchEvent("again", e.shiftKey);
          }
          break;
        case 27: // Escape
          this.close();
          break;
      }
    });

    this.findPreviousButton.addEventListener("click", () => {
      this.dispatchEvent("again", true);
    });

    this.findNextButton.addEventListener("click", () => {
      this.dispatchEvent("again", false);
    });

    this.highlightAll.addEventListener("click", () => {
      this.dispatchEvent("highlightallchange");
    });

    this.caseSensitive.addEventListener("click", () => {
      this.dispatchEvent("casesensitivitychange");
    });

    this.entireWord.addEventListener("click", () => {
      this.dispatchEvent("entirewordchange");
    });

    this.saveButton.addEventListener("click", (e) => {
      console.log('PDFViewWords words click listen saveButton', e);
      let temp = e.target.parentElement.parentElement.firstElementChild.firstElementChild.value;
      if(temp){
        let result = {
          event: 'saveKey',
          params: {
            keyword: temp
          }
        };
        window.parent.postMessage(result, window.location.origin);
      }
    });

    this.eventBus._on("resize", this._adjustWidth.bind(this));

    //多词高亮查询
    this.words = options.words || null;
    this.findValue = '';
    this.words.addEventListener("click", function(e) {
      let previousClick = true;
      if(e.target.className.includes('findNext')){
        this.findValue = e.target.parentElement.previousElementSibling.value;
        previousClick = false;
        console.log('PDFViewWords words click listen findNext', this.findValue);
        this.dispatchWordsEvent("again", previousClick, this.findValue);
      } else if(e.target.className.includes('findPrevious')){
        this.findValue = e.target.parentElement.previousElementSibling.value;
        console.log('PDFViewWords words click listen findPrevious', this.findValue);
        this.dispatchWordsEvent("again", previousClick, this.findValue);
      } else if(e.target.className.includes('saveToPopular')){
        this.findValue = e.target.parentElement.parentElement.firstElementChild.value;
        let temp = e.target.parentElement.parentElement.firstElementChild.getAttribute('data-id');
        let result = {
          event: 'saveKey',
          params: {
            keyword: this.findValue
          }
        };
        if(temp){
          result.params.id = temp;
        }
        console.log('PDFViewWords words click listen saveToPopular', this.findValue, temp);
        window.parent.postMessage(result, window.location.origin);
      } else if(e.target.className.includes('delete')){
        this.findValue = e.target.parentElement.parentElement.firstElementChild.value;
        let temp = e.target.parentElement.parentElement.firstElementChild.getAttribute('data-id');
        let result = {
          event: 'deleteKey',
          params: {}
        };
        if(temp){
          result.params.id = temp;
        }
        console.log('PDFViewWords words click listen delete', this.findValue, temp);
        window.parent.postMessage(result, window.location.origin);
        // e.target.parentElement.parentElement.remove();
      }
    }.bind(this));
    //iframe获取父容器传参
    // this.params = {
    //   "path": "",
    //   "keywords":[{
    //     "id": null,
    //     "keyword": "甲方于本合同生效之日起的内，向乙方预付本合同项下全部费用的0日40%，即元",
    //     "type":"NON_STANDARD"
    //   },{
    //     "id": "id，只有用户自定义的关键词才会有id",
    //     "keyword": "新增",
    //     "type":"PERSONAL"
    //   }]
    // };
    this.params = {};
    this.currentIndex = 0; // 多词交替搜索时当前索引
    window.addEventListener("message", receiveMessage.bind(this), false);
    function receiveMessage(event) {
      console.log('viewer.html message', event);
      this.params = event.data;
      this._initView();
    }

    this.multiFindPreviousButton.addEventListener("click", () => {
      console.log('multiFindPreviousButton');
      if(this.params.keywords && this.params.keywords.length > 0){
        this.dispatchWordsEvent("again", false, this.params.keywords[this.currentIndex].keyword);
          if(this.currentIndex === 0) { // 超出数组长度，重新循环
            this.currentIndex = this.params.keywords.length - 1;
          } else {
            this.currentIndex--;
          }
      }
    });
  
    this.multiFindNextButton.addEventListener("click", () => {
      console.log('multiFindNextButton');
      if(this.params.keywords && this.params.keywords.length > 0){
        this.dispatchWordsEvent("again", false, this.params.keywords[this.currentIndex].keyword);
          if(this.currentIndex === this.params.keywords.length - 1) { // 超出数组长度，重新循环
            this.currentIndex = 0;
          } else {
            this.currentIndex++;
          }
      }
    });
  }

  reset() {
    this.updateUIState();
  }

  dispatchEvent(type, findPrev) {
    this.eventBus.dispatch("find", {
      source: this,
      type,
      query: this.findField.value,
      phraseSearch: true,
      caseSensitive: this.caseSensitive.checked,
      entireWord: this.entireWord.checked,
      highlightAll: this.highlightAll.checked,
      findPrevious: findPrev,
    });
  }

  updateUIState(state, previous, matchesCount) {
    let notFound = false;
    let findMsg = "";
    let status = "";

    switch (state) {
      case FindState.FOUND:
        break;

      case FindState.PENDING:
        status = "pending";
        break;

      case FindState.NOT_FOUND:
        findMsg = this.l10n.get("find_not_found", null, "Phrase not found");
        notFound = true;
        break;

      case FindState.WRAPPED:
        if (previous) {
          findMsg = this.l10n.get(
            "find_reached_top",
            null,
            "Reached top of document, continued from bottom"
          );
        } else {
          findMsg = this.l10n.get(
            "find_reached_bottom",
            null,
            "Reached end of document, continued from top"
          );
        }
        break;
    }

    this.findField.classList.toggle("notFound", notFound);
    this.findField.setAttribute("data-status", status);

    Promise.resolve(findMsg).then(msg => {
      this.findMsg.textContent = msg;
      this._adjustWidth();
    });

    this.updateResultsCount(matchesCount);
  }

  updateResultsCount({ current = 0, total = 0 } = {}) {
    if (!this.findResultsCount) {
      return; // No UI control is provided.
    }
    const limit = MATCHES_COUNT_LIMIT;
    let matchesCountMsg = "";

    if (total > 0) {
      if (total > limit) {
        if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
          // TODO: Remove this hard-coded `[other]` form once plural support has
          // been implemented in the mozilla-central specific `l10n.js` file.
          matchesCountMsg = this.l10n.get(
            "find_match_count_limit[other]",
            {
              limit,
            },
            "More than {{limit}} matches"
          );
        } else {
          matchesCountMsg = this.l10n.get(
            "find_match_count_limit",
            {
              limit,
            },
            "More than {{limit}} match" + (limit !== 1 ? "es" : "")
          );
        }
      } else {
        if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("MOZCENTRAL")) {
          // TODO: Remove this hard-coded `[other]` form once plural support has
          // been implemented in the mozilla-central specific `l10n.js` file.
          matchesCountMsg = this.l10n.get(
            "find_match_count[other]",
            {
              current,
              total,
            },
            "{{current}} of {{total}} matches"
          );
        } else {
          matchesCountMsg = this.l10n.get(
            "find_match_count",
            {
              current,
              total,
            },
            "{{current}} of {{total}} match" + (total !== 1 ? "es" : "")
          );
        }
      }
    }
    Promise.resolve(matchesCountMsg).then(msg => {
      this.findResultsCount.textContent = msg;
      this.findResultsCount.classList.toggle("hidden", !total);
      // Since `updateResultsCount` may be called from `PDFFindController`,
      // ensure that the width of the findbar is always updated correctly.
      this._adjustWidth();
    });
  }

  open() {
    if (!this.opened) {
      this.opened = true;
      this.toggleButton.classList.add("toggled");
      this.bar.classList.remove("hidden");
    }
    this.findField.select();
    this.findField.focus();

    this._initView();
    this._adjustWidth();
  }

  close() {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.toggleButton.classList.remove("toggled");
    this.bar.classList.add("hidden");

    this.eventBus.dispatch("findbarclose", { source: this });
    this.dispatchWordsEvent();
  }

  toggle() {
    if (this.opened) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * @private
   */
  _adjustWidth() {
    if (!this.opened) {
      return;
    }

    // The find bar has an absolute position and thus the browser extends
    // its width to the maximum possible width once the find bar does not fit
    // entirely within the window anymore (and its elements are automatically
    // wrapped). Here we detect and fix that.
    this.bar.classList.remove("wrapContainers");

    const findbarHeight = this.bar.clientHeight;
    const inputContainerHeight = this.bar.firstElementChild.clientHeight;

    if (findbarHeight > inputContainerHeight) {
      // The findbar is taller than the input container, which means that
      // the browser wrapped some of the elements. For a consistent look,
      // wrap all of them to adjust the width of the find bar.
      this.bar.classList.add("wrapContainers");
    }
  }

  _initView(){
    // const hash = location.hash.split('#')[1];
    if(!this.params || JSON.stringify(this.params) === '{}') return;
    // const params = parseQueryString(hash);
    // if ("search" in params) {
      let tempHtml = '';
      // let keys = params.search.split(',');
      for(let i = 0; i <= this.params.keywords.length - 1; i++){
          let temp = '';
          switch(this.params.keywords[i].type){
            case 'NON_STANDARD':
            case 'CUSTOM': 
            temp = `<div class="list-item">
              <textarea class="toolbarField" disabled style="height: 16px; resize: vertical;" >${this.params.keywords[i].keyword}</textarea>
              <div class="splitToolbarButton">
                <button class="toolbarButton findPrevious" title="Find the previous occurrence of the phrase" tabindex="92" data-l10n-id="find_previous">
                  <span data-l10n-id="find_previous_label">Previous</span>
                </button>
                <div class="splitToolbarButtonSeparator"></div>
                <button class="toolbarButton findNext" title="Find the next occurrence of the phrase" tabindex="93" data-l10n-id="find_next">
                  <span data-l10n-id="find_next_label">Next</span>
                </button>
              </div>
            </div>`
            break;
            case 'PERSONAL': 
            temp = `<div class="list-item">
            <textarea data-id="${this.params.keywords[i].id}" class="toolbarField" style="height: 16px; resize: vertical;" />${this.params.keywords[i].keyword}</textarea>
            <div class="splitToolbarButton">
              <button class="toolbarButton findPrevious" title="Find the previous occurrence of the phrase" tabindex="92" data-l10n-id="find_previous">
                <span data-l10n-id="find_previous_label">Previous</span>
              </button>
              <div class="splitToolbarButtonSeparator"></div>
              <button class="toolbarButton findNext" title="Find the next occurrence of the phrase" tabindex="93" data-l10n-id="find_next">
                <span data-l10n-id="find_next_label">Next</span>
              </button>
            </div>
            <div class="saveToPopularContainer">
              <button class="toolbarField saveToPopular" style="margin-right: 2px;" tabindex="97">保存</button>
              <button class="toolbarField delete" tabindex="98">删除</button>
            </div>
          </div>`
            break;
          }
          tempHtml = tempHtml + temp;
      }
      this.words.innerHTML = tempHtml;
      this.dispatchWordsEvent();
    // }
  }
  dispatchWordsEvent(type = '', findPrev = false, value = '') {
    if(!value){
      let temp = this.params.keywords.map(item => item.keyword);
      value = temp.join(',');
    }
    this.eventBus.dispatch("findwords", {
      source: this,
      type,
      query: value,
      findPrevious: findPrev
    });
  }
  parseElement(htmlString){
    return new DOMParser().parseFromString(htmlString,'text/html').body.childNodes[0]
  }
}

export { PDFFindBar };
