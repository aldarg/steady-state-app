// v1-13 decision 1: the DOM helpers every part of the page uses, moved from
// ui.js. Nothing runs at import.

// Writes only what differs, so that a field being typed in keeps its caret.
export const setText = (element, text) => {
  if (element.textContent !== text) {
    element.textContent = text;
  }
};

export const setValue = (element, value) => {
  if (element.value !== value) {
    element.value = value;
  }
};

export const setChecked = (input, checked) => {
  if (input.checked !== checked) {
    input.checked = checked;
  }
};

// A message under a field: its text, or hidden and empty.
export const drawMessage = (element, text) => {
  setText(element, text ?? "");
  element.hidden = text === null;
};

// A dialog's cancel event (Escape, Android's back) is prevented, and `close`
// closes it through the controller instead of the browser.
export const onCancel = (on, dialog, close) =>
  on(dialog, "cancel", (event) => {
    event.preventDefault();
    close();
  });
