export const QUESTION_PACKS = {
    'young-adult': {
        name: 'Young Adult (20s - 30s)',
        description: 'Focus on career foundations, independence, worldview, and personal discovery.',
        questions: [
            { id: 'ya-career', category: 'Career & Ambitions', text: 'What is your current main occupation or project, and how do you feel about your career trajectory right now?' },
            { id: 'ya-world', category: 'Worldview', text: 'What major world event or societal trend occupies your mind the most today?' },
            { id: 'ya-family', category: 'Family & Relations', text: 'How has your relationship with your family and close friends evolved over the past 6 months?' },
            { id: 'ya-lessons', category: 'Personal Growth', text: 'What is the most important personal lesson or realization you have experienced recently?' },
            { id: 'ya-future', category: 'Vision', text: 'Where do you realistically see yourself living and working in 2 years?' }
        ]
    },
    'adult': {
        name: 'Adult & Established (30s+)',
        description: 'Focus on life balance, long-term vision, family transmission, and deep projects.',
        questions: [
            { id: 'ad-career', category: 'Career & Ambitions', text: 'How would you summarize your current professional life, major responsibilities, and main frustrations or prides?' },
            { id: 'ad-society', category: 'Worldview', text: 'What is your current perspective on society, technology (like AI), and the direction things are heading?' },
            { id: 'ad-family', category: 'Family & Transmission', text: 'What are you trying to transmit or teach to your children or close family members at this stage of their lives?' },
            { id: 'ad-projects', category: 'Personal Projects', text: 'What passion projects, hobbies, or personal experiments are keeping you energized right now?' },
            { id: 'ad-future', category: 'Capsule & Vision', text: 'If you could give one piece of advice to your future self looking back 5 years from now, what would it be?' }
        ]
    },
    'young-person': {
        name: 'Young Person / Student',
        description: 'Focus on studies, curiosities, friendships, and future dreams.',
        questions: [
            { id: 'yp-studies', category: 'Studies & Work', text: 'What are you studying or working on right now, and what do you enjoy most about it?' },
            { id: 'yp-friends', category: 'Friendships', text: 'Who are your closest friends, and what activities do you love doing together?' },
            { id: 'yp-curiosity', category: 'Learning', text: 'What skill or subject are you most curious about learning in the near future?' },
            { id: 'yp-pride', category: 'Achievements', text: 'What is something you are proud of achieving or discovering over the last 6 months?' },
            { id: 'yp-future', category: 'Future Dreams', text: 'What do you hope to be doing 5 years from now?' }
        ]
    }
};
