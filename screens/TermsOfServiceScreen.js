import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LAST_UPDATED = "January 2025";
const CONTACT_EMAIL = "support@darknite.app";

export default function TermsOfServiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleEmailContact = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Section title="Agreement to Terms">
          By accessing or using DarkNite ("the App"), you agree to be bound by
          these Terms of Service. If you do not agree to these terms, please do
          not use the App.
        </Section>

        <Section title="Eligibility">
          You must be at least 21 years old to use DarkNite. By using the App,
          you represent and warrant that you are at least 21 years of age and
          have the legal capacity to enter into these terms.
        </Section>

        <Section title="Account Registration">
          To use certain features, you must create an account. You agree to:
          {"\n\n"}
          <BulletPoint>Provide accurate and complete information</BulletPoint>
          <BulletPoint>Maintain the security of your account credentials</BulletPoint>
          <BulletPoint>Notify us immediately of any unauthorized use</BulletPoint>
          <BulletPoint>Be responsible for all activity under your account</BulletPoint>
        </Section>

        <Section title="User Content">
          You may post content including vibes, check-ins, and other information
          ("User Content"). By posting, you grant us a non-exclusive, royalty-free
          license to use, display, and distribute your content within the App.
          {"\n\n"}
          You agree not to post content that:
          {"\n\n"}
          <BulletPoint>Is false, misleading, or inaccurate</BulletPoint>
          <BulletPoint>Is defamatory, obscene, or offensive</BulletPoint>
          <BulletPoint>Infringes on intellectual property rights</BulletPoint>
          <BulletPoint>Promotes illegal activities</BulletPoint>
          <BulletPoint>Harasses or threatens others</BulletPoint>
          <BulletPoint>Contains spam or unauthorized advertising</BulletPoint>
        </Section>

        <Section title="Acceptable Use">
          You agree to use the App only for lawful purposes. You will not:
          {"\n\n"}
          <BulletPoint>Violate any applicable laws or regulations</BulletPoint>
          <BulletPoint>Interfere with or disrupt the App's functionality</BulletPoint>
          <BulletPoint>Attempt to gain unauthorized access</BulletPoint>
          <BulletPoint>Use automated systems or bots</BulletPoint>
          <BulletPoint>Collect user information without consent</BulletPoint>
          <BulletPoint>Impersonate others or misrepresent your identity</BulletPoint>
        </Section>

        <Section title="Venue Information">
          Information about venues, including crowd levels, wait times, and other
          details, is provided by users and may not always be accurate. We do not
          guarantee the accuracy of any venue information. Always verify details
          directly with venues when possible.
        </Section>

        <Section title="Intellectual Property">
          The App and its original content (excluding User Content) are owned by
          DarkNite and protected by copyright, trademark, and other laws. Our
          trademarks may not be used without our prior written consent.
        </Section>

        <Section title="Disclaimer of Warranties">
          THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT
          WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. YOUR
          USE OF THE APP IS AT YOUR OWN RISK.
        </Section>

        <Section title="Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, DARKNITE SHALL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM
          YOUR USE OF THE APP.
        </Section>

        <Section title="Indemnification">
          You agree to indemnify and hold DarkNite harmless from any claims,
          damages, or expenses arising from your use of the App or violation of
          these terms.
        </Section>

        <Section title="Termination">
          We may terminate or suspend your account at any time for violations of
          these terms or for any other reason at our discretion. Upon termination,
          your right to use the App will cease immediately.
        </Section>

        <Section title="Changes to Terms">
          We may modify these terms at any time. We will notify users of material
          changes through the App. Your continued use after changes constitutes
          acceptance of the new terms.
        </Section>

        <Section title="Governing Law">
          These terms shall be governed by the laws of the State of New York,
          without regard to its conflict of law provisions.
        </Section>

        <Section title="Contact Us">
          For questions about these Terms, please contact us at:
          {"\n\n"}
          <TouchableOpacity onPress={handleEmailContact}>
            <Text style={styles.link}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using DarkNite, you acknowledge that you have read and agree to
            these Terms of Service.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Helper components
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

function BulletPoint({ children }) {
  return (
    <Text style={styles.bulletPoint}>
      {"\n"}• {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050013",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168, 85, 247, 0.15)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 24,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#A855F7",
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: "#D1D5DB",
    lineHeight: 24,
  },
  bulletPoint: {
    fontSize: 15,
    color: "#D1D5DB",
    lineHeight: 24,
  },
  link: {
    color: "#A855F7",
    fontSize: 15,
    textDecorationLine: "underline",
  },
  footer: {
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(168, 85, 247, 0.15)",
  },
  footerText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    fontStyle: "italic",
  },
});
