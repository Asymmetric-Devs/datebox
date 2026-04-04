export type TabRoute = {
  key: string;
  title: string;
  focusedIcon: string;
  unfocusedIcon: string;
};

export const routes: TabRoute[] = [
  {
    key: "home",
    title: "Inicio",
    focusedIcon: "home",
    unfocusedIcon: "home-outline",
  },
  {
    key: "recuerdos",
    title: "Recuerdos",
    focusedIcon: "image-multiple",
    unfocusedIcon: "image-multiple-outline",
  },
  {
    key: "calendar",
    title: "Calendario",
    focusedIcon: "calendar-month",
    unfocusedIcon: "calendar-month-outline",
  },
  {
    key: "juegos",
    title: "Juegos",
    focusedIcon: "puzzle",
    unfocusedIcon: "puzzle-outline",
  },
];

/** @deprecated Use `routes` instead — there is no longer a differentiation between elder and non-elder users. */
export const elderRoutes = routes;
/** @deprecated Use `routes` instead — there is no longer a differentiation between elder and non-elder users. */
export const nonElderRoutes = routes;
