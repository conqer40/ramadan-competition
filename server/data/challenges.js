
const challenges = [
    { day: 1, name: 'قراءة الجزء الأول', desc: 'اقرأ الجزء الأول من القرآن', emoji: '📖', points: 100, type: 'khatmah', target: 1 },
    { day: 2, name: 'صلاة التراويح كاملة', desc: 'صلِّ التراويح كاملة في المسجد', emoji: '🕌', points: 150, type: 'worship', target: 'taraweeh' },
    { day: 3, name: 'إطعام صائم', desc: 'قدم وجبة إفطار لصائم', emoji: '🍽️', points: 200, type: 'manual', target: null },
    { day: 4, name: 'صلة الرحم', desc: 'تواصل مع أقاربك اليوم', emoji: '👨‍👩‍👧‍👦', points: 100, type: 'manual', target: null },
    { day: 5, name: 'الاستغفار 1000 مرة', desc: 'أكثر من الاستغفار اليوم', emoji: '🤲', points: 150, type: 'tasbih', target: 'istighfar', count: 1000 },
    { day: 6, name: 'الصدقة', desc: 'تصدق بمبلغ ولو بسيط', emoji: '💝', points: 200, type: 'worship', target: 'sadaqah' },
    { day: 7, name: 'حفظ 5 آيات', desc: 'احفظ 5 آيات جديدة', emoji: '📚', points: 250, type: 'manual', target: null },
    { day: 8, name: 'صلاة الضحى', desc: 'صلِّ صلاة الضحى', emoji: '☀️', points: 100, type: 'worship', target: 'dhuha' }, // Need to add Dhuha to tracker if not exists
    { day: 9, name: 'قيام الليل', desc: 'صلِّ في الثلث الأخير من الليل', emoji: '🌙', points: 200, type: 'worship', target: 'tahajjud' },
    { day: 10, name: 'ختم الجزء عم', desc: 'اختم الجزء 30 كاملاً', emoji: '✨', points: 300, type: 'khatmah', target: 30 },
    { day: 11, name: 'الدعاء للوالدين', desc: 'ادعُ لوالديك 100 مرة', emoji: '❤️', points: 100, type: 'manual', target: null },
    { day: 12, name: 'مساعدة محتاج', desc: 'ساعد شخصاً محتاجاً اليوم', emoji: '🤝', points: 200, type: 'manual', target: null },
    { day: 13, name: 'الصلاة على النبي 1000', desc: 'صلِّ على النبي 1000 مرة', emoji: '💚', points: 150, type: 'tasbih', target: 'salawat', count: 1000 },
    { day: 14, name: 'قراءة سورة الكهف', desc: 'اقرأ سورة الكهف كاملة', emoji: '📖', points: 150, type: 'manual', target: null },
    { day: 15, name: 'نصف رمضان!', desc: 'راجع أهدافك وجدد نيتك', emoji: '🎯', points: 100, type: 'manual', target: null },
    { day: 16, name: 'التسبيح 100 مرة', desc: 'سبحان الله وبحمده 100 مرة', emoji: '📿', points: 100, type: 'tasbih', target: 'subhanbihamdi', count: 100 },
    { day: 17, name: 'إفطار جماعي', desc: 'أفطر مع عائلتك أو أصدقائك', emoji: '👨‍👩‍👧‍👦', points: 150, type: 'manual', target: null },
    { day: 18, name: 'قراءة أذكار كاملة', desc: 'أذكار الصباح والمساء', emoji: '📿', points: 100, type: 'worship', target: 'tasbih' },
    { day: 19, name: 'الاعتكاف ساعة', desc: 'اعتكف في المسجد ساعة', emoji: '🕌', points: 200, type: 'manual', target: null },
    { day: 20, name: 'دخول العشر الأواخر', desc: 'نوِّ الاجتهاد في العشر', emoji: '🌟', points: 150, type: 'manual', target: null },
    { day: 21, name: 'ليلة وتر', desc: 'أحيِ الليلة الأولى من الوتر', emoji: '✨', points: 300, type: 'worship', target: 'tahajjud' },
    { day: 22, name: 'قيام الليل كاملاً', desc: 'صلِّ قيام الليل كاملاً', emoji: '🌙', points: 300, type: 'worship', target: 'tahajjud' },
    { day: 23, name: 'ليلة وتر', desc: 'أحيِ الليلة الثالثة من الوتر', emoji: '✨', points: 300, type: 'worship', target: 'tahajjud' },
    { day: 24, name: 'الدعاء ساعة كاملة', desc: 'ادعُ الله ساعة متواصلة', emoji: '🤲', points: 250, type: 'worship', target: 'dua' },
    { day: 25, name: 'ليلة وتر', desc: 'أحيِ الليلة الخامسة من الوتر', emoji: '✨', points: 300, type: 'worship', target: 'tahajjud' },
    { day: 26, name: 'زكاة الفطر', desc: 'أخرج زكاة الفطر', emoji: '💰', points: 200, type: 'manual', target: null },
    { day: 27, name: 'ليلة القدر', desc: 'أحيِ ليلة السابع والعشرين', emoji: '🌟', points: 500, type: 'worship', target: 'tahajjud' },
    { day: 28, name: 'ختم القرآن', desc: 'اختم القرآن مرة على الأقل', emoji: '📖', points: 400, type: 'khatmah', target: 'finish' },
    { day: 29, name: 'ليلة وتر', desc: 'أحيِ الليلة التاسعة من الوتر', emoji: '✨', points: 300, type: 'worship', target: 'tahajjud' },
    { day: 30, name: 'وداع رمضان', desc: 'ودع رمضان بالدعاء والشكر', emoji: '🤲', points: 200, type: 'worship', target: 'dua' }
];

module.exports = challenges;
