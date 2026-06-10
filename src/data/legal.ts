export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDoc {
  title: string
  lastUpdated: string
  sections: LegalSection[]
}

const CONTACT_EMAIL = 'vanshkapoor2905@gmail.com'

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  lastUpdated: 'June 10, 2026',
  sections: [
    {
      heading: 'Overview',
      paragraphs: [
        'GymTracker ("the App") helps you plan, log, and review your workouts. This policy explains what information the App collects, how it is used, and the choices you have. By using the App you agree to the practices described here.',
      ],
    },
    {
      heading: 'Information We Collect',
      paragraphs: [
        'Account information: when you sign in with Google, we receive your name, email address, and profile photo from your Google account. We never see your Google password.',
        'Fitness profile: information you choose to provide during onboarding or in Settings, such as biological sex, age, height, body weight, body fat percentage, fitness level, and training goals. Providing this is optional; it is used to estimate calories burned.',
        'Workout data: the workouts, exercises, sets, reps, weights, durations, and rest times you log, along with derived values such as estimated calories.',
        'Coach conversations: messages you send to the in-app AI coach and the responses you receive.',
      ],
    },
    {
      heading: 'How Your Information Is Used',
      paragraphs: [
        'To provide the App’s core features: logging workouts, showing your history and progress, and estimating calories burned.',
        'To personalize the experience, such as suggesting recent weights and showing your last session for an exercise.',
        'To answer questions you ask the AI coach. When you use the coach, your message and relevant workout context are processed by a third-party AI provider on our behalf to generate a response.',
        'We do not sell your personal information, and we do not use it for advertising.',
      ],
    },
    {
      heading: 'Where Your Data Is Stored',
      paragraphs: [
        'Your data is stored in Google Firebase (Firestore and Firebase Authentication), operated by Google LLC. Data is protected by per-user access rules: your data is only readable by your authenticated account.',
        'Standard service providers we rely on (such as Google Firebase, our hosting provider, and the AI provider used by the coach feature) process data only as needed to operate the App.',
      ],
    },
    {
      heading: 'Health Data Notice',
      paragraphs: [
        'Workout logs and fitness profile details are health-related information. The App uses them only to provide the features described above. Calorie figures are estimates based on standard MET formulas and your profile; they are not medical measurements.',
      ],
    },
    {
      heading: 'Data Retention & Deletion',
      paragraphs: [
        'Your data is retained for as long as your account exists so that your workout history remains available to you.',
        'You can delete individual workouts, sets, exercises, and coach conversations inside the App at any time.',
        `To delete your account and all associated data, contact us at ${CONTACT_EMAIL} and we will remove it within 30 days.`,
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'The App is not directed at children under 13 (or the minimum age in your jurisdiction), and we do not knowingly collect data from them.',
      ],
    },
    {
      heading: 'Changes to This Policy',
      paragraphs: [
        'We may update this policy from time to time. Material changes will be reflected by the "last updated" date above. Continued use of the App after a change means you accept the updated policy.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Questions about this policy or your data? Contact ${CONTACT_EMAIL}.`,
      ],
    },
  ],
}

export const TERMS_OF_USE: LegalDoc = {
  title: 'Terms of Use',
  lastUpdated: 'June 10, 2026',
  sections: [
    {
      heading: 'Acceptance of Terms',
      paragraphs: [
        'By signing in to or using GymTracker ("the App"), you agree to these Terms of Use and to the Privacy Policy. If you do not agree, do not use the App.',
      ],
    },
    {
      heading: 'The Service',
      paragraphs: [
        'The App lets you plan workout programs, log training sessions, review your history, estimate calories burned, and chat with an AI coach. The App is provided free of charge and may change, gain, or lose features at any time.',
      ],
    },
    {
      heading: 'Not Medical Advice',
      paragraphs: [
        'The App, including calorie estimates and AI coach responses, provides general fitness information only. It is not medical advice, diagnosis, or treatment, and it is not a substitute for guidance from a qualified physician, physiotherapist, or certified trainer.',
        'Consult a medical professional before starting or changing an exercise program, especially if you have any medical condition. Stop exercising and seek medical attention if you feel pain, dizziness, or discomfort.',
      ],
    },
    {
      heading: 'Assumption of Risk',
      paragraphs: [
        'Physical exercise carries inherent risks, including injury. You are solely responsible for exercising within your own limits and for using appropriate equipment and technique. You use the App and perform any logged activity at your own risk.',
      ],
    },
    {
      heading: 'AI Coach',
      paragraphs: [
        'Coach responses are generated by an AI model and may be inaccurate, incomplete, or unsuitable for your situation. Use your own judgment and verify important information independently.',
      ],
    },
    {
      heading: 'Your Account & Acceptable Use',
      paragraphs: [
        'You are responsible for the Google account you sign in with and for the accuracy of the information you log.',
        'You agree not to misuse the App, including attempting to access other users’ data, disrupting the service, reverse engineering it, or using it for unlawful purposes.',
      ],
    },
    {
      heading: 'Your Content',
      paragraphs: [
        'You retain ownership of the data you log. You grant us the limited rights needed to store and process that data solely to operate the App, as described in the Privacy Policy.',
      ],
    },
    {
      heading: 'Disclaimer & Limitation of Liability',
      paragraphs: [
        'The App is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, or uninterrupted availability.',
        'To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages, or for any injury, health outcome, or data loss arising from your use of the App.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You may stop using the App at any time and request deletion of your data as described in the Privacy Policy. We may suspend or terminate access for misuse of the service.',
      ],
    },
    {
      heading: 'Changes to These Terms',
      paragraphs: [
        'We may update these terms from time to time. Material changes will be reflected by the "last updated" date above. Continued use of the App after a change means you accept the updated terms.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Questions about these terms? Contact ${CONTACT_EMAIL}.`,
      ],
    },
  ],
}
