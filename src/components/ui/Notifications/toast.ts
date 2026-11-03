import { createElement } from "react";
import { toast } from "react-toastify";
import ToastMessage, { type ToastAction } from "./ToastMessage";

type Options = {
  description?: string;
  action?: ToastAction;
  autoClose?: number;
  toastId?: string;
};

export function showErrorToast(title: string, options: Options = {}) {
  const { description, action, autoClose = 10000, toastId } = options;
  toast.error(
    ({ closeToast }) =>
      createElement(ToastMessage, {
        title,
        description,
        action: action && {
          ...action,
          onClick: () => {
            closeToast();
            action.onClick();
          },
        },
      }),
    { autoClose, icon: false, toastId },
  );
}
