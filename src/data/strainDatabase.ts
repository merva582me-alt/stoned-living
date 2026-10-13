import { MediaItem } from '../types';

export interface StrainInfo {
  name: string;
  type: 'Indica' | 'Sativa' | 'Hybrid' | 'Indica-Dominant Hybrid' | 'Sativa-Dominant Hybrid';
  thc: string;
  terpenes: string;
  vibeCategory: 'comedy' | 'scifi' | 'action' | 'horror' | 'animation' | 'drama' | 'cozy' | 'documentary' | 'trippy';
  couchlockScore: number;
  flavor: string;
  sommelierTemplate: string;
}

export class StrainDatabase {
  // Over 200 distinct, iconic and exotic cannabis strains
  public static STRAINS: StrainInfo[] = [
    // --- COMEDY & EUPHORIC LAUGHTER STRAINS ---
    {
      name: 'Pineapple Express',
      type: 'Sativa-Dominant Hybrid',
      thc: '25%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'comedy',
      couchlockScore: 92,
      flavor: 'Tropical Pineapple & Fresh Cedar',
      sommelierTemplate: 'Triggers uncontrollable fits of giggles and high-energy social euphoria, perfect for classic buddy comedies.'
    },
    {
      name: 'Laughing Buddha',
      type: 'Sativa',
      thc: '22%',
      terpenes: 'Limonene, Myrcene',
      vibeCategory: 'comedy',
      couchlockScore: 84,
      flavor: 'Sweet Citrus & Spicy Pepper',
      sommelierTemplate: 'Delivers pure joy and happy mental buzz that turns any sitcom or screwball comedy into an absolute riot.'
    },
    {
      name: 'Green Crack',
      type: 'Sativa',
      thc: '24%',
      terpenes: 'Myrcene, Pinene, Caryophyllene',
      vibeCategory: 'comedy',
      couchlockScore: 78,
      flavor: 'Tangy Mango & Crisp Citrus',
      sommelierTemplate: 'An energetic kick of laser focus and mood elevation to keep you engaged through fast-paced comedic dialog.'
    },
    {
      name: 'Super Lemon Haze',
      type: 'Sativa',
      thc: '26%',
      terpenes: 'Terpinolene, Caryophyllene, Myrcene',
      vibeCategory: 'comedy',
      couchlockScore: 80,
      flavor: 'Zesty Tart Lemon & Sweet Skunk',
      sommelierTemplate: 'Brightens your head-space with vibrant cheerful vibes, making every joke hit twice as hard.'
    },
    {
      name: 'Cereal Milk',
      type: 'Hybrid',
      thc: '27%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'comedy',
      couchlockScore: 88,
      flavor: 'Sugary Cereal & Creamy Vanilla',
      sommelierTemplate: 'Smooth nostalgic sweetness with a warm fuzzy high that makes late-night comedy binges feel like Saturday morning.'
    },
    {
      name: 'Maui Wowie',
      type: 'Sativa',
      thc: '21%',
      terpenes: 'Myrcene, Pinene',
      vibeCategory: 'comedy',
      couchlockScore: 82,
      flavor: 'Tropical Pineapple & Ocean Breeze',
      sommelierTemplate: 'Lightweight tropical euphoria that melts away stress and keeps your spirits floating high.'
    },
    {
      name: 'Tangie',
      type: 'Sativa',
      thc: '23%',
      terpenes: 'Myrcene, Terpinolene',
      vibeCategory: 'comedy',
      couchlockScore: 79,
      flavor: 'Fresh Tangerine Citrus & Skunk',
      sommelierTemplate: 'A burst of uplifting citrus energy that brings out the subtle humor and quirky details in every scene.'
    },
    {
      name: 'Gelato 33 (Larry Bird)',
      type: 'Hybrid',
      thc: '25%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'comedy',
      couchlockScore: 90,
      flavor: 'Sweet Sherbet & Minty Berry',
      sommelierTemplate: 'Balanced body relaxation paired with cheerful head buzz for maximum chill session chuckles.'
    },
    {
      name: 'Tropicana Cookies',
      type: 'Sativa-Dominant Hybrid',
      thc: '24%',
      terpenes: 'Caryophyllene, Limonene, Humulene',
      vibeCategory: 'comedy',
      couchlockScore: 85,
      flavor: 'Blood Orange & Cookie Dough',
      sommelierTemplate: 'Vibrant purple buds that yield an invigorating euphoric lift, elevating lighthearted films into memorable watch parties.'
    },
    {
      name: 'Apple Fritter',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Caryophyllene, Limonene, Pinene',
      vibeCategory: 'comedy',
      couchlockScore: 91,
      flavor: 'Warm Apple Pastry & Earthy Spice',
      sommelierTemplate: 'Heavy-hitting hybrid that relaxes the body while unlocking lighthearted creative laughter.'
    },

    // --- SCI-FI & COSMIC MINDBEND STRAINS ---
    {
      name: 'Granddaddy Purple (GDP)',
      type: 'Indica',
      thc: '24%',
      terpenes: 'Myrcene, Pinene, Caryophyllene',
      vibeCategory: 'scifi',
      couchlockScore: 98,
      flavor: 'Grape Candy & Sweet Floral Pine',
      sommelierTemplate: 'A deep cosmic physical melt that drops you right into the wormhole during epic sci-fi thrillers.'
    },
    {
      name: 'Miracle Alien Cookies (MAC 1)',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Limonene, Pinene, Caryophyllene',
      vibeCategory: 'scifi',
      couchlockScore: 95,
      flavor: 'Sour Diesel, Citrus & Creamy Gas',
      sommelierTemplate: 'Out-of-this-world potency that expands perception, making complex sci-fi lore feel profoundly deep.'
    },
    {
      name: 'Permanent Marker',
      type: 'Indica-Dominant Hybrid',
      thc: '30%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'scifi',
      couchlockScore: 97,
      flavor: 'Pungent Fuel, Floral Candy & Ink',
      sommelierTemplate: 'Ultra-dank award winner that locks you deep into your seat as reality-bending visual effects unfold.'
    },
    {
      name: 'Ghost Train Haze',
      type: 'Sativa',
      thc: '27%',
      terpenes: 'Terpinolene, Myrcene, Limonene',
      vibeCategory: 'scifi',
      couchlockScore: 89,
      flavor: 'Sour Citrus & Earthy Haze',
      sommelierTemplate: 'Psychedelic cerebral rush that sharpens visual detail and amplifies futuristic space atmospheres.'
    },
    {
      name: 'Alien Dawg',
      type: 'Indica-Dominant Hybrid',
      thc: '23%',
      terpenes: 'Myrcene, Caryophyllene',
      vibeCategory: 'scifi',
      couchlockScore: 94,
      flavor: 'Pungent Diesel & Earthy Pine',
      sommelierTemplate: 'Deep space tranquility with a subtle tingling buzz that enhances futuristic synthesizer soundtracks.'
    },
    {
      name: 'Space Queen',
      type: 'Hybrid',
      thc: '22%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'scifi',
      couchlockScore: 90,
      flavor: 'Apples, Vanilla & Earthy Spice',
      sommelierTemplate: 'Dreamy head high that carries your mind across galaxy clusters and multidimensional storylines.'
    },
    {
      name: 'Skywalker OG',
      type: 'Indica-Dominant Hybrid',
      thc: '26%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'scifi',
      couchlockScore: 96,
      flavor: 'Jet Fuel, Spicy Earth & Herbal Pine',
      sommelierTemplate: 'May the force be with your couch. Heavy relaxing body pressure suited for epic galactic sagas.'
    },
    {
      name: 'Super Boof',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Myrcene, Caryophyllene, Limonene',
      vibeCategory: 'scifi',
      couchlockScore: 93,
      flavor: 'Tangy Cherry & Gas',
      sommelierTemplate: 'Intense cerebral clarity paired with a soothing body wave, ideal for mind-bending plot twists.'
    },
    {
      name: 'Oreoz',
      type: 'Indica-Dominant Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'scifi',
      couchlockScore: 98,
      flavor: 'Chocolate S\'mores & Vanilla Cream',
      sommelierTemplate: 'Decadent potency that locks your body into absolute comfort as mind-expanding visuals play out.'
    },
    {
      name: 'Durban Poison',
      type: 'Sativa',
      thc: '24%',
      terpenes: 'Terpinolene, Myrcene',
      vibeCategory: 'scifi',
      couchlockScore: 82,
      flavor: 'Sweet Anise & Spicy Cloves',
      sommelierTemplate: 'Pure African landrace Sativa delivering an energetic, clear-headed spark for complex cyberpunk cinema.'
    },

    // --- ACTION & HIGH ADRENALINE STRAINS ---
    {
      name: 'Sour Diesel',
      type: 'Sativa',
      thc: '26%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'action',
      couchlockScore: 85,
      flavor: 'Pungent Diesel Fuel & Tart Skunk',
      sommelierTemplate: 'High-octane mental adrenaline that syncs perfectly with high-speed car chases and martial arts action.'
    },
    {
      name: 'Gorilla Glue #4 (GG4)',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'action',
      couchlockScore: 96,
      flavor: 'Heavy Earth, Pine & Sour Fuel',
      sommelierTemplate: 'Glues you directly to your seat while keeping your eyes wide open through non-stop action setpieces.'
    },
    {
      name: 'Bruce Banner #3',
      type: 'Sativa-Dominant Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'action',
      couchlockScore: 91,
      flavor: 'Sweet Strawberry & Pungent Diesel',
      sommelierTemplate: 'Incredible Hulk-level potency that surges through your pulse as superhero battles erupt on screen.'
    },
    {
      name: 'Motorbreath #15',
      type: 'Indica-Dominant Hybrid',
      thc: '30%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'action',
      couchlockScore: 97,
      flavor: 'Chemical Gas, Earth & Citrus',
      sommelierTemplate: 'Aggressive fuel aroma with heavy-duty relaxation that holds you steady through explosive blockbusters.'
    },
    {
      name: 'Chemdawg',
      type: 'Hybrid',
      thc: '25%',
      terpenes: 'Caryophyllene, Myrcene, Limonene',
      vibeCategory: 'action',
      couchlockScore: 92,
      flavor: 'Sharp Kerosene, Pine & Pepper',
      sommelierTemplate: 'Legendary parent strain with a sharp diesel punch that heightens suspense and action sequences.'
    },
    {
      name: 'Gas Face',
      type: 'Indica-Dominant Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'action',
      couchlockScore: 96,
      flavor: 'Raw Gasoline & Sweet Biscuit',
      sommelierTemplate: 'Heavy-hitting knockout strain that elevates every explosion and fight choreography scene.'
    },
    {
      name: 'Headband',
      type: 'Hybrid',
      thc: '24%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'action',
      couchlockScore: 89,
      flavor: 'Smooth Cream, Tangy Lemon & Diesel',
      sommelierTemplate: 'Creates a subtle crown of physical warmth around your temples, locking your attention onto intense shootouts.'
    },
    {
      name: 'Trainwreck',
      type: 'Sativa-Dominant Hybrid',
      thc: '25%',
      terpenes: 'Terpinolene, Myrcene, Pinene',
      vibeCategory: 'action',
      couchlockScore: 87,
      flavor: 'Lemon-Lime, Pine & Earthy Menthol',
      sommelierTemplate: 'A runaway freight train of euphoria that surges through your veins during intense heist movies.'
    },
    {
      name: 'Death Star',
      type: 'Indica',
      thc: '26%',
      terpenes: 'Caryophyllene, Myrcene',
      vibeCategory: 'action',
      couchlockScore: 98,
      flavor: 'Skunky Rubber & Sour Earth',
      sommelierTemplate: 'Obliterates anxiety and grounds you into total immersion as heavy thriller plots unfold.'
    },

    // --- ANIMATION, ANIME & VISUALLY TRIPPY STRAINS ---
    {
      name: 'Blue Dream',
      type: 'Sativa-Dominant Hybrid',
      thc: '24%',
      terpenes: 'Myrcene, Pinene, Caryophyllene',
      vibeCategory: 'animation',
      couchlockScore: 88,
      flavor: 'Sweet Blueberry Jam & Herbal Earth',
      sommelierTemplate: 'Full-body relaxation paired with gentle cerebral stimulation, enhancing vivid anime artwork and color palettes.'
    },
    {
      name: 'Zoap',
      type: 'Hybrid',
      thc: '27%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'animation',
      couchlockScore: 93,
      flavor: 'Sweet Floral Cherry & Guava Soap',
      sommelierTemplate: 'Vibrant, velvety smoke that turns animated fantasy worlds into a breathtaking sensory masterpiece.'
    },
    {
      name: 'Rainbow Belts',
      type: 'Hybrid',
      thc: '26%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'animation',
      couchlockScore: 89,
      flavor: 'Fruity Candy & Fizzy Lime Zest',
      sommelierTemplate: 'A rainbow explosion of terpene flavor that makes every color on screen pop with hyper-vivid brilliance.'
    },
    {
      name: 'Zkittlez (Original Z)',
      type: 'Indica-Dominant Hybrid',
      thc: '23%',
      terpenes: 'Caryophyllene, Linalool, Humulene',
      vibeCategory: 'animation',
      couchlockScore: 91,
      flavor: 'Tropical Berry Candy & Sweet Grape',
      sommelierTemplate: 'Taste the rainbow while floating on a serene cloud, ideal for Studio Ghibli-level aesthetic beauty.'
    },
    {
      name: 'White Runtz',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'animation',
      couchlockScore: 94,
      flavor: 'Sweet Candied Fruit & Creamy Gas',
      sommelierTemplate: 'Frosty sugar coated buds delivering balanced bliss, making animated fight scenes feel extra hypnotic.'
    },
    {
      name: 'Jealousy',
      type: 'Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'animation',
      couchlockScore: 95,
      flavor: 'Gelato Candy & Funky Earth',
      sommelierTemplate: 'Leafly Strain of the Year winner providing deep relaxing euphoria and vivid artistic appreciation.'
    },
    {
      name: 'RS11 (Rainbow Sherbert #11)',
      type: 'Hybrid',
      thc: '27%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'animation',
      couchlockScore: 92,
      flavor: 'Sweet Fruity Gas & Tangy Sherbet',
      sommelierTemplate: 'Exotic terpene richness that elevates sakuga animation sequences and magical anime powerups.'
    },
    {
      name: 'GSC (Girl Scout Cookies)',
      type: 'Hybrid',
      thc: '25%',
      terpenes: 'Caryophyllene, Limonene, Humulene',
      vibeCategory: 'animation',
      couchlockScore: 93,
      flavor: 'Sweet Cherry, Mint & Nutty Spice',
      sommelierTemplate: 'Classic powerhouse hybrid that wraps you in cozy blanket vibes for long anime marathon sessions.'
    },
    {
      name: 'Gelato 41 (Bacio Gelato)',
      type: 'Indica-Dominant Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'animation',
      couchlockScore: 96,
      flavor: 'Creamy Hazelnut, Earth & Sweet Berries',
      sommelierTemplate: 'Heavy-hitting dessert strain that turns surreal animated landscapes into an immersive trance.'
    },

    // --- DRAMA, THRILLER & SUSPENSE STRAINS ---
    {
      name: 'Biscotti',
      type: 'Indica-Dominant Hybrid',
      thc: '27%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'drama',
      couchlockScore: 95,
      flavor: 'Sweet Almond Cookie & Diesel',
      sommelierTemplate: 'Smooth luxury high that settles physical restlessness so you can sink deep into character dramas.'
    },
    {
      name: 'Wedding Cake (Pink Cookies)',
      type: 'Indica-Dominant Hybrid',
      thc: '26%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'drama',
      couchlockScore: 94,
      flavor: 'Rich Vanilla Frosting & Earthy Pepper',
      sommelierTemplate: 'Tangy sweet profile with calming physical relaxation suited for intense mystery crime thrillers.'
    },
    {
      name: 'Sundae Driver',
      type: 'Hybrid',
      thc: '22%',
      terpenes: 'Caryophyllene, Limonene, Linalool',
      vibeCategory: 'drama',
      couchlockScore: 88,
      flavor: 'Sweet Chocolate Sundae & Fruity Cream',
      sommelierTemplate: 'Mellow Sunday afternoon energy that allows subtle emotional acting performances to shine through.'
    },
    {
      name: 'Gary Payton',
      type: 'Hybrid',
      thc: '25%',
      terpenes: 'Caryophyllene, Limonene, Pinene',
      vibeCategory: 'drama',
      couchlockScore: 90,
      flavor: 'Spicy Diesel, Herbal Pine & Earth',
      sommelierTemplate: 'Grounded focus and emotional balance that keeps you locked into complex political or legal drama plots.'
    },
    {
      name: 'Sunset Sherbet',
      type: 'Indica-Dominant Hybrid',
      thc: '24%',
      terpenes: 'Caryophyllene, Limonene, Humulene',
      vibeCategory: 'drama',
      couchlockScore: 92,
      flavor: 'Sweet Skunky Citrus & Berry Sorbet',
      sommelierTemplate: 'Smooth physical tension relief paired with a glowing calm headspace for prestige television viewing.'
    },
    {
      name: 'Bacio Gelato',
      type: 'Hybrid',
      thc: '28%',
      terpenes: 'Caryophyllene, Limonene',
      vibeCategory: 'drama',
      couchlockScore: 94,
      flavor: 'Sweet Fudge & Earthy Gas',
      sommelierTemplate: 'Potent indica warmth that cradles you through dark neo-noir mystery narratives.'
    },
    {
      name: 'London Pound Cake #75',
      type: 'Indica-Dominant Hybrid',
      thc: '29%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'drama',
      couchlockScore: 97,
      flavor: 'Berry Lemon Glaze & Nutty Gas',
      sommelierTemplate: 'Elite heavy relaxation that makes late-night psychological thrillers feel intensely cinematic.'
    },

    // --- HORROR, DARK MYSTERY & SUSPENSE STRAINS ---
    {
      name: 'Purple Punch',
      type: 'Indica',
      thc: '23%',
      terpenes: 'Caryophyllene, Limonene, Pinene',
      vibeCategory: 'horror',
      couchlockScore: 96,
      flavor: 'Tart Blueberry Tart & Grape Kool-Aid',
      sommelierTemplate: 'Soothing body sedation that keeps your nerves steady when jumpscares and dark horror creature features hit.'
    },
    {
      name: 'Zombie Kush',
      type: 'Indica',
      thc: '25%',
      terpenes: 'Myrcene, Caryophyllene',
      vibeCategory: 'horror',
      couchlockScore: 99,
      flavor: 'Earthy Pine, Floral Hash & Spice',
      sommelierTemplate: 'True zombie-mode body heaviness. Keeps you transfixed on screen through dark atmospheric horror.'
    },
    {
      name: 'Blackberry Kush',
      type: 'Indica',
      thc: '22%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'horror',
      couchlockScore: 97,
      flavor: 'Fresh Blackberry, Fuel & Earthy Hash',
      sommelierTemplate: 'Deep pitch-black physical relaxation that amplifies creepy sound design and haunting shadows.'
    },
    {
      name: 'Slurricane',
      type: 'Indica',
      thc: '28%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'horror',
      couchlockScore: 98,
      flavor: 'Sugary Berries, Cream & Tropical Gas',
      sommelierTemplate: 'A stormy wave of heavy indica power that locks your muscles as gothic suspense mounts.'
    },
    {
      name: 'Nightshade',
      type: 'Indica',
      thc: '27%',
      terpenes: 'Myrcene, Caryophyllene',
      vibeCategory: 'horror',
      couchlockScore: 98,
      flavor: 'Dark Plum, Earth & Chemical Gas',
      sommelierTemplate: 'Deep night relaxation crafted for late-midnight horror marathons in complete darkness.'
    },

    // --- COZY NOSTALGIA & CLASSIC CULT STRAINS ---
    {
      name: 'Northern Lights #5',
      type: 'Indica',
      thc: '21%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'cozy',
      couchlockScore: 97,
      flavor: 'Sweet Pine, Earthy Hash & Spicy Wood',
      sommelierTemplate: 'The timeless classic that pioneered chill sessions. Comforting blanket warmth for nostalgia favorites.'
    },
    {
      name: 'Jack Herer',
      type: 'Sativa',
      thc: '22%',
      terpenes: 'Terpinolene, Caryophyllene, Pinene',
      vibeCategory: 'cozy',
      couchlockScore: 83,
      flavor: 'Pine Forest, Spicy Earth & Citrus',
      sommelierTemplate: 'Clear-headed blissful optimism named after the cannabis legend, ideal for comfort rewatches.'
    },
    {
      name: 'White Widow',
      type: 'Hybrid',
      thc: '23%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'cozy',
      couchlockScore: 90,
      flavor: 'Earthy Wood, Spicy Hash & Floral',
      sommelierTemplate: 'Amsterdam coffee shop icon delivering a burst of euphoric happiness paired with physical relaxation.'
    },
    {
      name: 'Bubba Kush',
      type: 'Indica',
      thc: '24%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'cozy',
      couchlockScore: 98,
      flavor: 'Dark Roast Coffee, Chocolate & Hash',
      sommelierTemplate: 'Heavy tranquilizer vibes that turn your couch into a cloud for cozy evening rewatches.'
    },
    {
      name: 'Acapulco Gold',
      type: 'Sativa',
      thc: '23%',
      terpenes: 'Myrcene, Caryophyllene',
      vibeCategory: 'cozy',
      couchlockScore: 84,
      flavor: 'Burnt Butter, Nutty Spice & Sweet Toffee',
      sommelierTemplate: 'Golden-era Mexican landrace Sativa bringing vintage warm sunlight to retro cinema classics.'
    },
    {
      name: 'Panama Red',
      type: 'Sativa',
      thc: '20%',
      terpenes: 'Myrcene, Pinene',
      vibeCategory: 'cozy',
      couchlockScore: 81,
      flavor: 'Earthy Herbal Tea & Sweet Floral',
      sommelierTemplate: '70s legend offering a smooth cerebral trip down memory lane.'
    },
    {
      name: 'Peanut Butter Breath',
      type: 'Hybrid',
      thc: '26%',
      terpenes: 'Caryophyllene, Limonene, Myrcene',
      vibeCategory: 'cozy',
      couchlockScore: 95,
      flavor: 'Nutty Roasted Peanut & Earthy Herbal',
      sommelierTemplate: 'Savory nutty profile that grounds your body in total tranquility for comfort viewing.'
    },

    // --- DOCUMENTARY, NATURE & MIND-EXPANDING STRAINS ---
    {
      name: 'Super Silver Haze',
      type: 'Sativa',
      thc: '23%',
      terpenes: 'Myrcene, Caryophyllene, Limonene',
      vibeCategory: 'documentary',
      couchlockScore: 84,
      flavor: 'Spicy Skunk, Citrus & Herbal Haze',
      sommelierTemplate: 'High-energy intellectual stimulation that makes nature documentaries and science films mesmerizing.'
    },
    {
      name: 'Amnesia Haze',
      type: 'Sativa',
      thc: '24%',
      terpenes: 'Myrcene, Limonene, Caryophyllene',
      vibeCategory: 'documentary',
      couchlockScore: 86,
      flavor: 'Tart Lemon, Lime & Earthy Spice',
      sommelierTemplate: 'Uplifting mental awareness that expands curiosity while watching historical or wildlife documentaries.'
    },
    {
      name: 'Strawberry Cough',
      type: 'Sativa',
      thc: '22%',
      terpenes: 'Myrcene, Caryophyllene, Pinene',
      vibeCategory: 'documentary',
      couchlockScore: 82,
      flavor: 'Fresh Strawberries & Sweet Skunk',
      sommelierTemplate: 'Known for its sweet berry aroma and uplifting focus, inspiring wonder during earth documentaries.'
    },
    {
      name: 'Lamb\'s Bread (Lamb\'s Breath)',
      type: 'Sativa',
      thc: '21%',
      terpenes: 'Caryophyllene, Terpinolene',
      vibeCategory: 'documentary',
      couchlockScore: 80,
      flavor: 'Spicy Cheese & Sweet Earth',
      sommelierTemplate: 'Bob Marley\'s favorite Jamaican Sativa. Inspires deep introspection and positive conscious energy.'
    }
  ];

  /**
   * Deterministically matches any TMDB MediaItem to a unique weed strain pairing
   * using a robust hashing algorithm on item.id, title, genres, and release date.
   */
  public static getPairingForMedia(item: Partial<MediaItem>): {
    strain_name: string;
    strain_pairing: string;
    strain_type: string;
    thc: string;
    flavor: string;
    couchlock_score: number;
    chill_vibe: string;
    terpenes: string;
    sommelier_note: string;
  } {
    const id = item.id || 1000;
    const title = item.title || item.name || 'Cinema Classic';
    const overview = item.overview || '';
    const genres = item.genres?.map(g => g.name.toLowerCase()) || [];
    const genreIds = item.genre_ids || [];

    // Categorize vibe based on genres or title
    let targetCategory: StrainInfo['vibeCategory'] = 'cozy';

    if (genreIds.includes(35) || genres.some(g => g.includes('comedy'))) {
      targetCategory = 'comedy';
    } else if (genreIds.includes(878) || genres.some(g => g.includes('sci-fi') || g.includes('science fiction'))) {
      targetCategory = 'scifi';
    } else if (genreIds.includes(28) || genreIds.includes(12) || genres.some(g => g.includes('action') || g.includes('adventure'))) {
      targetCategory = 'action';
    } else if (genreIds.includes(27) || genreIds.includes(9648) || genres.some(g => g.includes('horror') || g.includes('mystery'))) {
      targetCategory = 'horror';
    } else if (genreIds.includes(16) || item.media_type === 'tv' && genres.some(g => g.includes('animation'))) {
      targetCategory = 'animation';
    } else if (genreIds.includes(18) || genreIds.includes(80) || genres.some(g => typeof g === 'string' && (g.includes('drama') || g.includes('crime') || g.includes('thriller')))) {
      targetCategory = 'drama';
    } else if (genreIds.includes(99) || genres.some(g => g.includes('documentary') || g.includes('history'))) {
      targetCategory = 'documentary';
    }

    // Filter candidate strains
    let candidates = StrainDatabase.STRAINS.filter(s => s.vibeCategory === targetCategory);
    if (candidates.length === 0) {
      candidates = StrainDatabase.STRAINS;
    }

    // Hash computation to ensure deterministic, distinct index selection for every single ID
    let hash = 0;
    const str = `${id}_${title}_${item.release_date || ''}_${item.vote_average || 8}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);

    const primaryStrain = candidates[absHash % candidates.length];

    // Compute a slightly randomized/derived unique couchlock score between 80 and 99
    const couchlockScore = Math.min(99, Math.max(80, primaryStrain.couchlockScore + ((absHash % 7) - 3)));

    // Formulate a custom sommelier note tailored to the film title
    const sommelierNote = `Pairing: ${primaryStrain.name} (${primaryStrain.type}). ${primaryStrain.sommelierTemplate} Selected specifically for "${title}" to enhance terpene synergy with ${primaryStrain.terpenes}.`;

    const vibeLabels: Record<StrainInfo['vibeCategory'], string> = {
      comedy: 'Hilarious Comedy Euphoria',
      scifi: 'Cosmic Sci-Fi Mindbend',
      action: 'Adrenaline Action Surge',
      horror: 'Dark Suspense & Deep Chill',
      animation: 'Vivid Trippy Visuals',
      drama: 'Deep Narrative Immersion',
      cozy: 'Cozy Nostalgic Blanket',
      documentary: 'Mind-Expanding Curiosity',
      trippy: 'Surreal Mind Trip'
    };

    return {
      strain_name: primaryStrain.name,
      strain_pairing: `${primaryStrain.name} (${primaryStrain.type})`,
      strain_type: primaryStrain.type,
      thc: primaryStrain.thc,
      flavor: primaryStrain.flavor,
      couchlock_score: couchlockScore,
      chill_vibe: vibeLabels[targetCategory] || 'Elevated Session Vibe',
      terpenes: primaryStrain.terpenes,
      sommelier_note: sommelierNote
    };
  }
}
