window.__ModuleLoader__.load({
  id: "dsh-collab-side-panel",
  factory: () => {
    const module = { exports: {} };
    const exports = module.exports;

    if (window.__pluginmaxSidePanel === undefined) {
      const typeRegistry = new Map();
      const fallbackTitles = {
        communication: "沟通",
        "data-agent": "数据洞察",
        "task-drafts": "任务草稿",
      };
      let state = {
        open: false,
        openTabs: [],
        activeTab: undefined,
        lastTab: "communication",
        expanded: false,
        tabMeta: {},
      };
      const listeners = new Set();

      const registrationFor = (type) =>
        typeRegistry.get(type) ?? {
          type,
          defaultTitle: fallbackTitles[type] ?? type,
          singleton: type === "task-drafts",
          closable: true,
          draggable: true,
        };
      const defaultTab = (type) => {
        const registration = registrationFor(type);
        return {
          type,
          title: registration.defaultTitle,
          sessionId: "",
        };
      };
      const typeOf = (tab) =>
        state.tabMeta?.[tab]?.type ??
        String(tab).split(":")[0];
      const describe = (tab) => {
        const type = typeOf(tab);
        return {
          ...defaultTab(type),
          ...(state.tabMeta?.[tab] ?? {}),
        };
      };
      const tabId = (type) =>
        registrationFor(type).singleton === true
          ? type
          : `${type}:${
              window.crypto?.randomUUID?.() ??
              `${Date.now().toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 9)}`
            }`;
      const emit = (next) => {
        state = next;
        window.__pluginmaxShell?.setMeetingOpen?.(state.open);
        window.__pluginmaxShell?.setSidePanelExpanded?.(state.expanded);
        for (const listener of listeners) listener();
      };

      const service = {
        version: 1,
        registerType(definition) {
          const type = String(definition?.type ?? "").trim();
          if (type === "") {
            throw new Error("side-panel tab type must not be empty");
          }
          const registration = {
            ...registrationFor(type),
            ...definition,
            type,
            defaultTitle:
              String(
                definition.defaultTitle ??
                  registrationFor(type).defaultTitle ??
                  type,
              ).trim() || type,
          };
          typeRegistry.set(type, registration);

          const tabMeta = { ...state.tabMeta };
          let changed = false;
          for (const tab of state.openTabs) {
            if (typeOf(tab) !== type || tabMeta[tab] !== undefined) continue;
            tabMeta[tab] = defaultTab(type);
            changed = true;
          }
          if (changed) emit({ ...state, tabMeta });

          return () => {
            if (typeRegistry.get(type) === registration) {
              typeRegistry.delete(type);
            }
          };
        },
        getRegistry() {
          return [...typeRegistry.values()];
        },
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        openTab(tab) {
          const meta =
            state.tabMeta?.[tab] ??
            defaultTab(String(tab).split(":")[0]);
          emit({
            ...state,
            open: true,
            openTabs: state.openTabs.includes(tab)
              ? state.openTabs
              : [...state.openTabs, tab],
            activeTab: tab,
            lastTab: tab,
            tabMeta: {
              ...state.tabMeta,
              [tab]: meta,
            },
          });
        },
        closeTab(tab) {
          const closingIndex = state.openTabs.indexOf(tab);
          const openTabs = state.openTabs.filter((item) => item !== tab);
          const activeTab =
            state.activeTab !== tab && openTabs.includes(state.activeTab)
              ? state.activeTab
              : openTabs[Math.min(closingIndex, openTabs.length - 1)];
          emit({
            ...state,
            open: openTabs.length > 0,
            openTabs,
            activeTab,
            lastTab: activeTab,
            expanded: openTabs.length > 0 ? state.expanded : false,
          });
        },
        openNewTab(type) {
          const registration = registrationFor(type);
          const existing =
            registration.singleton === true
              ? state.openTabs.find((tab) => typeOf(tab) === type)
              : undefined;
          if (existing !== undefined) {
            this.activate(existing);
            return existing;
          }
          const tab = tabId(type);
          const ordinal =
            state.openTabs.filter((item) => typeOf(item) === type).length + 1;
          const title =
            typeof registration.newTabTitle === "function"
              ? registration.newTabTitle(ordinal)
              : `${registration.defaultTitle} ${ordinal}`;
          const meta = {
            ...defaultTab(type),
            title,
          };
          emit({
            ...state,
            open: true,
            openTabs: [...state.openTabs, tab],
            activeTab: tab,
            lastTab: tab,
            tabMeta: { ...state.tabMeta, [tab]: meta },
          });
          return tab;
        },
        openType(type) {
          return this.openNewTab(type);
        },
        updateTab(tab, patch) {
          if (!state.openTabs.includes(tab)) return;
          emit({
            ...state,
            tabMeta: {
              ...state.tabMeta,
              [tab]: { ...describe(tab), ...patch },
            },
          });
        },
        reorderTab(sourceTab, targetTab) {
          if (sourceTab === targetTab) return;
          const sourceIndex = state.openTabs.indexOf(sourceTab);
          const targetIndex = state.openTabs.indexOf(targetTab);
          if (sourceIndex < 0 || targetIndex < 0) return;
          const openTabs = [...state.openTabs];
          const [moved] = openTabs.splice(sourceIndex, 1);
          openTabs.splice(targetIndex, 0, moved);
          emit({ ...state, openTabs });
        },
        describeTab(tab) {
          return describe(tab);
        },
        tabsOfType(type) {
          return state.openTabs.filter((tab) => typeOf(tab) === type);
        },
        activateType(type) {
          const existing = state.openTabs.find(
            (tab) => typeOf(tab) === type,
          );
          if (existing !== undefined) {
            this.activate(existing);
            return existing;
          }
          return this.openNewTab(type);
        },
        toggleTab(tab) {
          if (state.open && state.activeTab === tab) this.closeTab(tab);
          else this.openTab(tab);
        },
        openWorkspace(tabs, active = tabs[0]) {
          const requestedTabs = [...new Set(tabs)];
          const openTabs =
            state.openTabs.length > 0 ? state.openTabs : requestedTabs;
          const tabMeta = { ...state.tabMeta };
          for (const tab of openTabs) {
            tabMeta[tab] ??= defaultTab(String(tab).split(":")[0]);
          }
          const nextActive = openTabs.includes(state.activeTab)
            ? state.activeTab
            : openTabs.includes(active)
              ? active
              : openTabs[0];
          emit({
            ...state,
            open: openTabs.length > 0,
            openTabs,
            activeTab: nextActive,
            lastTab: nextActive,
            expanded: openTabs.length > 0 ? state.expanded : false,
            tabMeta,
          });
        },
        activate(tab) {
          if (!state.openTabs.includes(tab)) return;
          emit({
            ...state,
            open: true,
            activeTab: tab,
            lastTab: tab,
          });
        },
        closeAll() {
          emit({
            ...state,
            open: false,
            expanded: false,
          });
        },
        restore() {
          this.openTab(state.lastTab ?? "communication");
        },
        setExpanded(expanded) {
          emit({ ...state, expanded: expanded === true });
        },
        toggleExpanded() {
          this.setExpanded(!state.expanded);
        },
      };
      window.__pluginmaxSidePanel = service;
    }

    exports.inject = ["slots"];
    exports.apply = () => {};
    return module.exports;
  },
});
