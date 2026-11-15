import { useTranslation } from "react-i18next";
import { AllowLocalConversationsSwitch } from "#/components/features/settings/app-settings/allow-local-conversations-switch";
import {
  SdkSectionPage,
  type SettingsSourceConfig,
} from "#/components/features/settings/sdk-settings/sdk-section-page";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useConversationWorkspace } from "#/hooks/query/use-conversation-workspace";
import { useSettings } from "#/hooks/query/use-settings";
import { I18nKey } from "#/i18n/declaration";

const CONTAINER_FIELD_KEYS = new Set([
  "container_memory",
  "container_cpus",
  "container_browser",
]);

const HOST_RUNTIMES = ["local", "worktree"];

function RuntimeSettingsScreen() {
  const { t } = useTranslation();
  const { backend } = useActiveBackend();
  const { data: settings } = useSettings();
  const { dockerSelectable, serverInfoLoading } = useConversationWorkspace();
  const dockerUnavailable = !serverInfoLoading && !dockerSelectable;
  const savedRuntime = settings?.conversation_settings?.default_runtime;
  const savedDocker = savedRuntime === "docker";
  const showAllowLocal = backend.kind === "local" && dockerSelectable;
  const localDisallowed =
    showAllowLocal && settings?.allow_local_conversations === false;

  const source: SettingsSourceConfig = {
    settingsSource: "conversation_settings",
    sectionKeys: ["runtime"],
  };
  if (dockerUnavailable) {
    source.excludeKeys = CONTAINER_FIELD_KEYS;
    // A saved Docker default stays selectable so the field shows what is saved.
    if (!savedDocker) source.excludeChoices = { default_runtime: ["docker"] };
  }
  if (localDisallowed) {
    // A saved host default stays selectable so the field shows what is saved.
    source.excludeChoices = {
      default_runtime: HOST_RUNTIMES.filter((r) => r !== savedRuntime),
    };
  }
  const showDockerUnavailable = dockerUnavailable && savedDocker;

  return (
    <SdkSectionPage
      settingsSources={[source]}
      header={
        showAllowLocal || showDockerUnavailable
          ? () => (
              <>
                {showAllowLocal && <AllowLocalConversationsSwitch />}
                {showDockerUnavailable && (
                  <p
                    data-testid="runtime-docker-unavailable"
                    className="text-sm text-muted"
                  >
                    {t(I18nKey.SETTINGS$RUNTIME_DOCKER_UNAVAILABLE)}
                  </p>
                )}
              </>
            )
          : undefined
      }
      testId="runtime-settings-screen"
    />
  );
}

export default RuntimeSettingsScreen;
