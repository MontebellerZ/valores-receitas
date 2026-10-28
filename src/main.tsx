import { createRoot } from "react-dom/client";
import Notifications from "./components/ui/Notifications";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./app";

// Navigation blocking (unsaved edits) requires a data router.
const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <>
    <RouterProvider router={router} />
    <Notifications />
  </>,
);
