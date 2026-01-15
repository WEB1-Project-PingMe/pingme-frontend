import {
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("/", "./App.tsx"),
  route("chat/:uuid", "./component/chat-window.tsx"),
] satisfies RouteConfig;
