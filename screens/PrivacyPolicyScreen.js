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
import IconButton from "../components/IconButton";

const LAST_UPDATED = "February 2026";
const CONTACT_EMAIL = "privacy@darknite.app";
const WEBSITE_URL = "https://darknite.app";

export default function PrivacyPolicyScreen({ navigation }) {
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
        <IconButton onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#A855F7" />
        </IconButton>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last Updated: {LAST_UPDATED}</Text>

        <Section title="Introduction">
          DarkNite ("we", "our", or "us") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our mobile application.
        </Section>

        <Section title="Information We Collect">
          <BulletPoint>
            <Bold>Account Information:</Bold> Email address, username, and password when you create an account.
          </BulletPoint>
          <BulletPoint>
            <Bold>Profile Information:</Bold> Your preferences including favorite neighborhoods, music genres, and going out schedule.
          </BulletPoint>
          <BulletPoint>
            <Bold>Activity Data:</Bold> Vibes you post, moves you set, and venues you interact with.
          </BulletPoint>
          <BulletPoint>
            <Bold>Device Information:</Bold> Device type, operating system, and app version for troubleshooting.
          </BulletPoint>
        </Section>

        <Section title="How We Use Your Information">
          <BulletPoint>To provide and maintain our service</BulletPoint>
          <BulletPoint>To personalize your experience and show relevant venues</BulletPoint>
          <BulletPoint>To send you notifications about venue activity (with your permission)</BulletPoint>
          <BulletPoint>To improve our app based on usage patterns</BulletPoint>
          <BulletPoint>To detect and prevent fraud or abuse</BulletPoint>
        </Section>

        <Section title="Information Sharing">
          We do not sell your personal information. We may share information:
          {"\n\n"}
          <BulletPoint>
            <Bold>Publicly:</Bold> Vibes and check-ins are visible to other users (without identifying you personally unless you choose to share your username).
          </BulletPoint>
          <BulletPoint>
            <Bold>Service Providers:</Bold> With third parties who help us operate our service (hosting, analytics).
          </BulletPoint>
          <BulletPoint>
            <Bold>Legal Requirements:</Bold> When required by law or to protect our rights.
          </BulletPoint>
        </Section>

        <Section title="Data Security">
          We implement appropriate security measures to protect your information:
          {"\n\n"}
          <BulletPoint>Encrypted data transmission (HTTPS/TLS)</BulletPoint>
          <BulletPoint>Secure database storage with access controls</BulletPoint>
          <BulletPoint>Regular security audits and updates</BulletPoint>
        </Section>

        <Section title="Your Rights">
          You have the right to:
          {"\n\n"}
          <BulletPoint>Access your personal data</BulletPoint>
          <BulletPoint>Correct inaccurate data</BulletPoint>
          <BulletPoint>Delete your account and associated data</BulletPoint>
          <BulletPoint>Opt out of marketing communications</BulletPoint>
          <BulletPoint>Request a copy of your data</BulletPoint>
        </Section>

        <Section title="Data Retention">
          We retain your data for as long as your account is active. When you delete
          your account, we will delete your personal information within 30 days,
          except where we need to retain it for legal purposes.
        </Section>

        <Section title="Children's Privacy">
          DarkNite is intended for users who are at least 21 years old. We do not
          knowingly collect information from anyone under 21. If we learn we have
          collected such information, we will delete it immediately.
        </Section>

        <Section title="Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify you
          of any changes by posting the new policy in the app and updating the
          "Last Updated" date.
        </Section>

        <Section title="Contact Us">
          If you have questions about this Privacy Policy or our practices, please
          contact us at:
          {"\n\n"}
          <TouchableOpacity onPress={handleEmailContact}>
            <Text style={styles.link}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using DarkNite, you agree to this Privacy Policy.
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

function Bold({ children }) {
  return <Text style={styles.bold}>{children}</Text>;
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
  bold: {
    fontWeight: "600",
    color: "#F9FAFB",
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
