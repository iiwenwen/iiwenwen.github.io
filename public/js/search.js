(function () {
  const baseUrl =
    document
      .querySelector('meta[name="base-url"]')
      ?.getAttribute("content") || "/";

  let pagefindReady = false;
  let pagefindLoading = false;
  const callbacks = [];

  function loadPagefind(cb) {
    if (pagefindReady) {
      cb();
      return;
    }
    callbacks.push(cb);
    if (pagefindLoading) return;
    pagefindLoading = true;
    var script = document.createElement("script");
    script.src = baseUrl + "pagefind/pagefind-ui.js";
    script.onload = function () {
      pagefindReady = true;
      callbacks.forEach(function (fn) {
        fn();
      });
    };
    document.head.appendChild(script);
  }

  let modalInstance = null;

  function createUI(element, afterInit) {
    loadPagefind(function () {
      if (typeof PagefindUI === "undefined") return;
      var instance = new PagefindUI({
        element: element,
        showSubResults: true,
        showImages: false,
      });
      if (afterInit) afterInit(instance);
    });
  }

  function focusInput(container) {
    setTimeout(function () {
      var input = container.querySelector(".pagefind-ui__search-input");
      if (input) input.focus();
    }, 150);
  }

  var modal = document.getElementById("search-modal");
  var trigger = document.querySelector(".search-trigger");
  var closeBtn = document.querySelector(".search-modal-close");

  var searchEl = document.getElementById("search");

  if (modal && trigger && closeBtn) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      modal.showModal();
      if (!modalInstance) {
        createUI(searchEl, function (instance) {
          modalInstance = instance;
          focusInput(modal);
        });
      } else {
        focusInput(modal);
      }
    });

    closeBtn.addEventListener("click", function () {
      modal.close();
    });

    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.close();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        modal.showModal();
        if (!modalInstance) {
          createUI(searchEl, function (instance) {
            modalInstance = instance;
            focusInput(modal);
          });
        } else {
          focusInput(modal);
        }
      }
      if (e.key === "Escape" && modal.open) {
        modal.close();
      }
    });
  }

  var searchPage = document.getElementById("search-page");
  if (searchPage) {
    createUI(searchPage);
  }
})();
