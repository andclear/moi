import { Cursor } from "animal-island-ui";
import { RouterProvider } from "react-router";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";

export function App() {
  return (
    <AppProviders>
      <Cursor>
        <RouterProvider router={router} />
      </Cursor>
    </AppProviders>
  );
}
