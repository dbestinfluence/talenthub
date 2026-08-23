// Pure, dependency-free helpers for turning scraped posts into profile
// insights.

export interface RawPostLike {
  caption: string;
  likes: number;
  comments: number;
  views?: number | null;
  shares?: number | null;
  saves?: number | null;
  reposts?: number | null;
  postedAt: string;
  postUrl: string;
  thumbnailUrl?: string;
}


export interface HashtagCount {
  tag: string;
  count: number;
}


export interface MentionCount {
  mention: string;
  count: number;
}


export interface ProfileInsights {

  totalPosts: number;


  avgLikes: number;

  avgComments: number;

  avgViews: number;

  avgShares: number;

  avgSaves: number;

  avgReposts: number;



  // Engagement Rate
  erFollowers: number;

  erViews: number;

  erTalenthub: number;



  topHashtags: HashtagCount[];

  topMentions: MentionCount[];

}



const HASHTAG_REGEX = /#([a-z0-9_]+)/gi;

const MENTION_REGEX = /@([a-z0-9_.]+)/gi;



export function extractHashtags(
  caption: string
): string[] {

  const matches =
    (caption ?? "").matchAll(HASHTAG_REGEX);


  return Array.from(
    matches,
    (m) => m[1].toLowerCase()
  );

}



export function extractMentions(
  caption: string
): string[] {

  const matches =
    (caption ?? "").matchAll(MENTION_REGEX);


  return Array.from(
    matches,
    (m) => m[1].toLowerCase()
  );

}



function topN<T extends string>(
  values:T[],
  n:number
):{key:T;count:number}[] {


  const counts = new Map<T,number>();


  for(const value of values){

    counts.set(
      value,
      (counts.get(value) ?? 0)+1
    );

  }


  return Array.from(counts.entries())

    .sort(
      (a,b)=>b[1]-a[1]
    )

    .slice(0,n)

    .map(
      ([key,count])=>({
        key,
        count
      })
    );

}




export function filterPostsByRange<T extends RawPostLike>(
  posts:T[],
  days:number
):T[] {


  const cutoff =
    Date.now() -
    days *
    24 *
    60 *
    60 *
    1000;



  return posts.filter((p)=>{


    const t =
      new Date(p.postedAt).getTime();



    return Number.isNaN(t)
      ?
      true
      :
      t >= cutoff;


  });


}




export function computeInsightsFromPosts(

  posts:RawPostLike[],

  followers:number,

  totalPostFallback:number,

  hashtagLimit=10,

  mentionLimit=5

):ProfileInsights {


  const postCount =
    posts.length;



  /*
   * Total metric
   */

  const sumLikes =
    posts.reduce(
      (sum,p)=>
        sum+(p.likes ?? 0),
      0
    );


  const sumComments =
    posts.reduce(
      (sum,p)=>
        sum+(p.comments ?? 0),
      0
    );


  const sumViews =
    posts.reduce(
      (sum,p)=>
        sum+(p.views ?? 0),
      0
    );


  const sumShares =
    posts.reduce(
      (sum,p)=>
        sum+(p.shares ?? 0),
      0
    );


  const sumSaves =
    posts.reduce(
      (sum,p)=>
        sum+(p.saves ?? 0),
      0
    );


  const sumReposts =
    posts.reduce(
      (sum,p)=>
        sum+(p.reposts ?? 0),
      0
    );




  /*
   * Average per post
   */

  const avgLikes =
    postCount > 0
    ?
    sumLikes/postCount
    :
    0;


  const avgComments =
    postCount > 0
    ?
    sumComments/postCount
    :
    0;


  const avgViews =
    postCount > 0
    ?
    sumViews/postCount
    :
    0;


  const avgShares =
    postCount > 0
    ?
    sumShares/postCount
    :
    0;


  const avgSaves =
    postCount > 0
    ?
    sumSaves/postCount
    :
    0;


  const avgReposts =
    postCount > 0
    ?
    sumReposts/postCount
    :
    0;




  /*
   * ER by Followers
   *
   * (avg likes + avg comments + avg shares + avg saves)
   * ----------------------------------------------- x100
   * followers
   */

  const erFollowers =

    followers > 0

    ?

    (
      (
        avgLikes +
        avgComments +
        avgShares +
        avgSaves
      )

      /

      followers

    ) * 100

    :

    0;




  /*
   * ER by Views
   *
   * engagement / average views
   */

  const erViews =

    avgViews > 0

    ?

    (
      (
        avgLikes +
        avgComments +
        avgShares +
        avgSaves
      )

      /

      avgViews

    ) * 100

    :

    0;




  /*
   * Talenthub ER
   *
   * (likes+comments+shares+saves+views)
   * ---------------------------------- x100
   * followers
   */

  const erTalenthub =

    followers > 0

    ?

    (
      (
        avgLikes +
        avgComments +
        avgShares +
        avgSaves +
        avgViews
      )

      /

      followers

    ) * 100

    :

    0;




  const allHashtags =
    posts.flatMap(
      (p)=>
        extractHashtags(
          p.caption
        )
    );


  const allMentions =
    posts.flatMap(
      (p)=>
        extractMentions(
          p.caption
        )
    );



  const topHashtags =
    topN(
      allHashtags,
      hashtagLimit
    )
    .map(
      ({key,count})=>({
        tag:key,
        count
      })
    );



  const topMentions =
    topN(
      allMentions,
      mentionLimit
    )
    .map(
      ({key,count})=>({
        mention:key,
        count
      })
    );




  return {


    totalPosts:
      postCount || totalPostFallback,


    avgLikes:
      Math.round(avgLikes),


    avgComments:
      Math.round(avgComments),


    avgViews:
      Math.round(avgViews),


    avgShares:
      Math.round(avgShares),


    avgSaves:
      Math.round(avgSaves),


    avgReposts:
      Math.round(avgReposts),



    erFollowers:
      Number(
        erFollowers.toFixed(2)
      ),


    erViews:
      Number(
        erViews.toFixed(2)
      ),


    erTalenthub:
      Number(
        erTalenthub.toFixed(2)
      ),



    topHashtags,

    topMentions,

  };

}





export function computeProfileInsights(

  profile:{
    followers:number;

    totalPost:number;

    posts:RawPostLike[];

  },

  hashtagLimit=10,

  mentionLimit=5

):ProfileInsights {


  return computeInsightsFromPosts(

    profile.posts,

    profile.followers,

    profile.totalPost,

    hashtagLimit,

    mentionLimit

  );

}