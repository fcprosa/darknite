import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TERMS_CONTENT = `
Last Updated: January 2025

1. ACCEPTANCE OF TERMS
By accessing and using DarkNite ("the App"), you accept and agree to be bound by these Terms of Service.

2. USE OF SERVICE
2.1 Eligibility: You must be at least 18 years old to use DarkNite.
2.2 Account: You are responsible for maintaining the confidentiality of your account.
2.3 Prohibited Conduct: You agree not to:
   • Post false or misleading information
   • Harass or harm other users
   • Violate any applicable laws
   • Share inappropriate content

3. USER CONTENT
3.1 You retain ownership of content you post
3.2 You grant DarkNite a license to use, display, and distribute your content
3.3 You are responsible for the content you post

4. VENUE INFORMATION
4.1 Venue data is provided for informational purposes
4.2 We do not guarantee accuracy of venue information
4.3 Vibes reflect user opinions, not official venue information

5. PRIVACY
Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.

6. DISCLAIMERS
6.1 THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES
6.2 We are not responsible for venue conditions or third-party actions
6.3 Use the app at your own risk

7. LIMITATION OF LIABILITY
DarkNite shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.

8. CHANGES TO TERMS
We may modify these terms at any time. Continued use of the App constitutes acceptance of modified terms.

9. TERMINATION
We reserve the right to terminate or suspend access to the App at our discretion.

10. CONTACT
For questions about these Terms, contact us at:
legal@darknite.app

11. GOVERNING LAW
These Terms are governed by the laws of the United States.
`;

const PRIVACY_CONTENT = `
Last Updated: January 2025

1. INFORMATION WE COLLECT
1.1 Account Information:
   • Email address
   • Username
   • Profile information

1.2 Usage Data:
   • Vibes posted
   • Venue check-ins
   • App interactions

1.3 Location Data:
   • Approximate location for venue recommendations
   • You can disable location access in settings

2. HOW WE USE YOUR INFORMATION
2.1 To provide and improve the App
2.2 To personalize your experience
2.3 To communicate with you
2.4 To ensure safety and security
2.5 To analyze app usage

3. SHARING YOUR INFORMATION
3.1 Public Information:
   • Your username, vibes, and check-ins may be visible to other users
   • You can control visibility in Privacy Settings

3.2 We do not sell your personal information

3.3 We may share data with:
   • Service providers (hosting, analytics)
   • Law enforcement (when legally required)

4. DATA SECURITY
4.1 We use industry-standard security measures
4.2 No method of transmission is 100% secure
4.3 You are responsible for your account security

5. YOUR RIGHTS
5.1 Access your data
5.2 Delete your account and data
5.3 Opt-out of communications
5.4 Control privacy settings

6. DATA RETENTION
6.1 We retain data while your account is active
6.2 Deleted data is permanently removed within 30 days
6.3 Some data may be retained for legal compliance

7. COOKIES & ANALYTICS
7.1 We use cookies to improve the App
7.2 We use analytics to understand usage
7.3 You can disable cookies in your device settings

8. CHILDREN'S PRIVACY
DarkNite is not intended for users under 18. We do not knowingly collect data from children.

9. INTERNATIONAL USERS
Your information may be transferred to and processed in the United States.

10. CHANGES TO PRIVACY POLICY
We may update this Privacy Policy. We will notify you of significant changes.

11. CONTACT US
For privacy questions or requests:
privacy@darknite.app

12. YOUR CALIFORNIA PRIVACY RIGHTS
If you are a California resident, you have additional rights under CCPA. Contact us for details.

13. GDPR COMPLIANCE
For EU residents, we comply with GDPR requirements. You have rights to access, rectification, erasure, and data portability.
`;

// Exported without a Modal wrapper so it can be embedded inside an existing
// Modal (e.g. AuthModal) without triggering iOS's silent double-modal failure.
export function LegalContent({ type, onClose }) {
  const isTerms = type === "terms";
  const title = isTerms ? "Terms of Service" : "Privacy Policy";
  const content = isTerms ? TERMS_CONTENT : PRIVACY_CONTENT;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Ionicons
            name={isTerms ? "document-text" : "shield-checkmark"}
            size={24}
            color="#A855F7"
          />
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.contentScroll}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.contentText}>{content}</Text>
        </ScrollView>

        {/* Footer Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Standalone modal variant — used on screens that are not already inside a Modal.
export default function LegalModal({ visible, type, onClose }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <LegalContent type={type} onClose={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E1B2E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,85,247,0.2)",
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginHorizontal: 12,
  },
  closeButton: {
    padding: 4,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  contentText: {
    fontSize: 14,
    color: "#E2E8F0",
    lineHeight: 22,
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,85,247,0.2)",
  },
  closeButtonBottom: {
    backgroundColor: "#A855F7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
