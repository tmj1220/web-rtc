// import "core-js";
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import App from "./App";
import Login from "./Login";
// import "antd/dist/antd.min.css";
import "./index.css";

function Application() {
  const [auth, setAuth] = useState<boolean>(false);
  useEffect(() => {
    const token = window.localStorage.getItem("token") as string;
    if (token && token !== "") {
      setAuth(true);
    }
  }, []);
  return auth ? (
    <App
      changeAuth={(status) => {
        setAuth(status);
      }}
      auth={auth}
    />
  ) : (
    <Login
      changeAuth={(status) => {
        setAuth(status);
      }}
    />
  );
}

ReactDOM.render(<Application />, document.getElementById("root"));
