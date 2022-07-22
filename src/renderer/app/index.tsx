import React from "react";
import "./style.less";
import Initialization from "./Initialization";
import DataManager from "./DataManager";
import Mask from "./Mask";
import Main from "./Main";
import Header from "./Header";

export default function App() {
  return (
    <>
      <Initialization />
      <DataManager />
      <div className="my-app">
        <Mask />
        <Header />
        <Main />
      </div>
    </>
  );
}