# dsh-collab-demo-phone-tablet-order

Optional, detachable phone/tablet finished-goods order demo.

This package owns its fixture, Mock OMS and WMS MCP servers, task action card,
workbench display profile, prompts and Demo receipts. Shared platform code only
provides generic MCP provider routing, task-detail slots and workbench display
profile registration.

Enable the package only through:

```sh
PLUGINMAX_ENABLE_PHONE_TABLET_DEMO=1 ./scripts/install-profile.sh
```

The WMS business write is performed through the standard MCP tool
`wms_rebalance_work_order_create`. The package HTTP routes only authenticate a
human, issue and validate an Action Ticket, invoke that MCP tool, and persist
the task receipt. No Demo REST route writes business data directly.

Preview and remove Demo-owned storage before deleting the package:

```sh
DSH_HOME="$PWD/.tmp/dsh-home" \
  node plugins/dsh-collab-demo-phone-tablet-order/scripts/remove-demo-state.mjs

DSH_HOME="$PWD/.tmp/dsh-home" \
  node plugins/dsh-collab-demo-phone-tablet-order/scripts/remove-demo-state.mjs --apply
```

The cleanup removes the two MCP install records, tasks in
`手机平板订单履约演示`, the `履约 AI 伙伴` instance, Demo order/Data Fabric
records, profile brief items, task receipts, runtime fixture and WMS state.
Then remove `dsh-collab-demo-phone-tablet-order` from the profile, unset
`PLUGINMAX_ENABLE_PHONE_TABLET_DEMO`, and restart the host.
