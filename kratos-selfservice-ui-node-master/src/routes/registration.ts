// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { UiNodeInputAttributes } from "@ory/client"
import { UserAuthCard } from "@ory/elements-markup"
import {
  filterNodesByGroups,
  isUiNodeInputAttributes,
} from "@ory/integrations/ui"
import {
  defaultConfig,
  getUrlForFlow,
  isQuerySet,
  logger,
  redirectOnSoftError,
  requireNoAuth,
  RouteCreator,
  RouteRegistrator,
} from "../pkg"

// A simple express handler that shows the registration screen.
export const createRegistrationRoute: RouteCreator =
  (createHelpers) => (req, res, next) => {
    res.locals.projectName = "Create account"

    const { flow, return_to = "", login_challenge } = req.query
    const { frontend, kratosBrowserUrl, logoUrl } = createHelpers(req, res)

    const initFlowQuery = new URLSearchParams({
      return_to: return_to.toString(),
    })

    if (isQuerySet(login_challenge)) {
      logger.debug("login_challenge found in URL query: ", { query: req.query })
      initFlowQuery.append("login_challenge", login_challenge)
    } else {
      logger.debug("no login_challenge found in URL query: ", {
        query: req.query,
      })
    }

    const initFlowUrl = getUrlForFlow(
      kratosBrowserUrl,
      "registration",
      initFlowQuery,
    )

    // The flow is used to identify the settings and registration flow and
    // return data like the csrf_token and so on.
    if (!isQuerySet(flow)) {
      logger.debug("No flow ID found in URL query initializing login flow", {
        query: req.query,
      })
      res.redirect(303, initFlowUrl)
      return
    }

    frontend
      .getRegistrationFlow({ id: flow, cookie: req.header("Cookie") })
      .then(({ data: flow }) => {
        // Render the data using a view (e.g. Jade Template):
        const initLoginQuery = new URLSearchParams({
          return_to: return_to.toString(),
        })
        if (flow.oauth2_login_request?.challenge) {
          initLoginQuery.set(
            "login_challenge",
            flow.oauth2_login_request.challenge,
          )
        }
        res.render("registration", {
          nodes: flow.ui.nodes,
          webAuthnHandler: filterNodesByGroups({
            nodes: flow.ui.nodes,
            groups: ["webauthn"],
            attributes: ["button"],
            withoutDefaultAttributes: true,
            withoutDefaultGroup: true,
          })
            .filter(({ attributes }) => isUiNodeInputAttributes(attributes))
            .map(({ attributes }) => {
              return (attributes as UiNodeInputAttributes).onclick
            })
            .filter((onClickAction) => !!onClickAction),
          card: UserAuthCard({
            title: "Register an account",
            flow: flow,
            ...(flow.oauth2_login_request && {
              subtitle: `To authenticate ${
                flow.oauth2_login_request.client.client_name ||
                flow.oauth2_login_request.client.client_id
              }`,
            }),
            flowType: "registration",
            cardImage: logoUrl,
            additionalProps: {
              loginURL: getUrlForFlow(
                kratosBrowserUrl,
                "login",
                initLoginQuery,
              ),
            },
          }),
        })
      })
      .catch(redirectOnSoftError(res, next, initFlowUrl))
  }

export const registerRegistrationRoute: RouteRegistrator = (
  app,
  createHelpers = defaultConfig,
) => {
  app.get(
    "/registration",
    requireNoAuth(createHelpers),
    createRegistrationRoute(createHelpers),
  )
}
