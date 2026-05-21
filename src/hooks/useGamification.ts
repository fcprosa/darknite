import { useCallback } from "react";
import { useAppContext } from "../../contexts/AppContext";
import {
  awardXP as awardXPService,
  computeXPAwardPreview,
} from "../../services/gamificationService";

export function useGamification() {
  const {
    gamification,
    gamificationLoading,
    refreshGamification,
    loadGamification,
  } = useAppContext();

  const awardXP = useCallback(
    async (userId, action, options = {}) => {
      const result = await awardXPService(userId, action, options);
      await refreshGamification(userId);
      return result;
    },
    [refreshGamification]
  );

  const previewXP = useCallback(
    (userId, action, options = {}) =>
      computeXPAwardPreview(userId, action, options),
    []
  );

  return {
    gamification,
    loading: gamificationLoading,
    refreshGamification,
    loadGamification,
    awardXP,
    previewXP,
    totalXp: gamification?.totalXp ?? 0,
    level: gamification?.level,
    streak: gamification?.streak?.current ?? 0,
    badges: gamification?.badges ?? [],
    lastCity: gamification?.lastCity ?? null,
  };
}
