import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);

  const id = Number(searchParams.get("id"));


  const creator = await prisma.mst_creators.findUnique({
    where:{
      id
    }
  });


  if(!creator){
    return NextResponse.json(
      {
        error:"Creator not found"
      },
      {
        status:404
      }
    );
  }


  const posts = await prisma.dtl_creator_posts.findMany({

    where:{
      creator_id:id
    },

    orderBy:{
      posted_at:"desc"
    },

    take:5

  });



  return NextResponse.json({

    profile:{

      id:creator.id,

      name:creator.name,

      username:creator.username,

      photoUrl:creator.photo_url,


      followers:creator.followers ?? 0,

      following:creator.following ?? 0,


      socialMedia:creator.social_media,


      totalPost:creator.total_post ?? 0,


      averageView:creator.average_view ?? 0,

      averageViewBrand:creator.average_view_brand ?? 0,


      avgLikes:creator.avg_likes ?? 0,

      avgComments:creator.avg_comments ?? 0,

      avgShares:creator.avg_shares ?? 0,

      avgSaves:creator.avg_saves ?? 0,

      avgReposts:creator.avg_reposts ?? 0,


      erFollowers:Number(creator.er_followers ?? 0),

      erViews:Number(creator.er_views ?? 0),

      erTalenthub:Number(creator.er_talenthub ?? 0),


      topHashtags:creator.top_hashtags ?? [],

      topMentions:creator.top_mentions ?? [],


      lastScrapedAt:creator.last_scraped_at

    },


    posts:posts.map(post=>({

      id:post.id,

      postUrl:post.post_url ?? "",

      thumbnailUrl:post.thumbnail_url ?? "",

      caption:post.caption ?? "",

      likes:post.likes ?? 0,

      comments:post.comments ?? 0,

      views:post.views ?? 0,

      shares:post.shares,

      saves:post.saves,

      reposts:post.reposts,


      postedAt:
        post.posted_at
        ? post.posted_at.toISOString()
        :""

    }))

  });

}