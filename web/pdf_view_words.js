import { parseQueryString } from "./ui_utils.js";

class PDFViewWords {
    constructor(options, eventBus){
        this.opened = false;
        this.eventBus = eventBus;
        this.toggleButton = options.toggleButton || null;
        this.words = options.words || null;
        this.findValue = '';

        // Add event listeners to the DOM elements.
        this.toggleButton.addEventListener("click", () => {
            console.log('PDFViewWords toggleButton click listen');
            this.toggle();
        });
        this.words.addEventListener("click", (e) => {
            let previousClick = true;
            if(e.target.className.includes('findNext')){
                this.findValue = e.target.parentElement.previousElementSibling.innerText;
                previousClick = false;
                console.log('PDFViewWords words click listen findNext', this.findValue);
            } else if(e.target.className.includes('findPrevious')){
                this.findValue = e.target.parentElement.previousElementSibling.innerText;
                console.log('PDFViewWords words click listen findPrevious', this.findValue);
            }
            this.dispatchEvent("again", previousClick);
        });

        // this._initView();
        console.log('PDFViewWords constructor start');
    }
    _initView(){
        const hash = location.hash.split('#')[1];
        const params = parseQueryString(hash);
        if ("search" in params) {
            let tempHtml = '';
            let keys = params.search.split(',');
            for(let i = 0; i <= keys.length -1; i++){
                tempHtml = tempHtml + `<div class="list-item">
                <div class="toolbarField">${keys[i]}</div>
                <div class="splitToolbarButton">
                  <button class="toolbarButton findPrevious" title="Find the previous occurrence of the phrase" tabindex="92" data-l10n-id="find_previous">
                    <span data-l10n-id="find_previous_label">Previous</span>
                  </button>
                  <div class="splitToolbarButtonSeparator"></div>
                  <button class="toolbarButton findNext" title="Find the next occurrence of the phrase" tabindex="93" data-l10n-id="find_next">
                    <span data-l10n-id="find_next_label">Next</span>
                  </button>
                </div>
              </div>`;
            }
            this.words.innerHTML = tempHtml;
        }
    }
    dispatchEvent(type, findPrev) {
        this.eventBus.dispatch("find", {
            source: this,
            type,
            query: this.findValue,
            phraseSearch: false,
            caseSensitive: false,
            entireWord: false,
            highlightAll: true,
            findPrevious: findPrev,
        });
    }
    open() {
        if (!this.opened) {
          this.opened = true;
          this.toggleButton.classList.add("toggled");
          this.words.classList.remove("hidden");
        }
    
        this._initView();
        this._adjustWidth();
      }
    
      close() {
        if (!this.opened) {
          return;
        }
        this.opened = false;
        this.toggleButton.classList.remove("toggled");
        this.words.classList.add("hidden");
    
        // this.eventBus.dispatch("findbarclose", { source: this });
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
    this.words.classList.remove("wrapContainers");

    const findbarHeight = this.words.clientHeight;
    const inputContainerHeight = this.words.firstElementChild.clientHeight;

    if (findbarHeight > inputContainerHeight) {
      // The findbar is taller than the input container, which means that
      // the browser wrapped some of the elements. For a consistent look,
      // wrap all of them to adjust the width of the find bar.
      this.words.classList.add("wrapContainers");
    }
  }
}

export { PDFViewWords };