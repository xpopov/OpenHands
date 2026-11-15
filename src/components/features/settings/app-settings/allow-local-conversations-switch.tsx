import { useTranslation } from "react-i18next";
import { SettingsSwitch } from "#/components/features/settings/settings-switch";
import { useSaveSettings } from "#/hooks/mutation/use-save-settings";
import { useSettings } from "#/hooks/query/use-settings";
import { I18nKey } from "#/i18n/declaration";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { retrieveAxiosErrorMessage } from "#/utils/retrieve-axios-error-message";

export function AllowLocalConversationsSwitch() {
  const { t } = useTranslation("openhands");
  const { data: settings } = useSettings();
  const { mutate: saveSettings, isPending } = useSaveSettings();

  const handleToggle = (allow: boolean) => {
    saveSettings(
      { allow_local_conversations: allow },
      {
        onError: (error) => {
          displayErrorToast(
            retrieveAxiosErrorMessage(error) || t(I18nKey.ERROR$GENERIC),
          );
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <SettingsSwitch
        testId="allow-local-conversations-switch"
        isToggled={settings?.allow_local_conversations !== false}
        isDisabled={!settings || isPending}
        onToggle={handleToggle}
      >
        {t(I18nKey.SETTINGS$ALLOW_LOCAL_CONVERSATIONS)}
      </SettingsSwitch>
      <p className="text-xs text-muted">
        {t(I18nKey.SETTINGS$ALLOW_LOCAL_CONVERSATIONS_HINT)}
      </p>
    </div>
  );
}
