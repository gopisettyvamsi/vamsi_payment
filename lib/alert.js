import { Alert, Platform } from "react-native";

export const showAlert = (title, message, buttons) => {
  if (Platform.OS === "web") {
    const result = window.confirm(`${title}\n\n${message || ""}`);
    if (buttons && buttons.length > 0) {
      if (result) {
        // User clicked OK - find the confirm/destructive/last button
        const confirmBtn = buttons.find(b => b.style === "destructive") || buttons[buttons.length - 1];
        if (confirmBtn?.onPress) confirmBtn.onPress();
      } else {
        // User clicked Cancel
        const cancelBtn = buttons.find(b => b.style === "cancel");
        if (cancelBtn?.onPress) cancelBtn.onPress();
      }
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export const showMessage = (title, message, onOk) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message || ""}`);
    if (onOk) onOk();
  } else {
    Alert.alert(title, message, [{ text: "OK", onPress: onOk }]);
  }
};
