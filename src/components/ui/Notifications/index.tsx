import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import styles from "./styles.module.scss";

export default function Notifications() {
  return (
    <ToastContainer
      className={styles.container}
      position="top-right"
      autoClose={4000}
      closeOnClick
      newestOnTop
      pauseOnFocusLoss
      draggable
      limit={4}
      theme="light"
    />
  );
}
