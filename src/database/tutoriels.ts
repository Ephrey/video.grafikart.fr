import neo4j from 'neo4j-driver'
import { NotFoundRecord } from '../errors'
import { Node } from 'neo4j-driver/types/v1'
import Tutoriel from '../model/tutoriel'

export interface INodeTech extends Node {
  properties: {
    name: string,
    slug: string
  }
}

export interface INodeTutoriel extends Node {
  uuid: number,
  name: string,
  slug: string,
  content: string,
  created_at: number,
  video: string,
  youtube: string,
  image: string
}

export interface INodeFormation extends Node {
  name: string
  slug: string
}

export default class Tutoriels {

  static async find (id: number): Promise<Tutoriel> {
    let driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', process.env.DB_PASSWORD))
    let session = driver.session()
    try {
      let record = await session.run(`
        MATCH (t:Tutoriel {uuid: {id}})
        OPTIONAL MATCH (t)-[:REQUIRE|:TEACH]->(techs:Technology)
        OPTIONAL MATCH (t)<-[:INCLUDE*]-(f:Formation)
        OPTIONAL MATCH (sibling:Tutoriel)<-[:INCLUDE*]-(f)
        OPTIONAL MATCH (sibling)<-[r:REQUIRE*]-(t)
        RETURN
        t {.name, .slug, .uuid, .created_at, .video, .content, .youtube, .image},
        f {.name, .slug},
        count(distinct sibling) as siblings,
        count(distinct r) as previous,
        collect(techs.name) as techs`, { id })
      if (record.records.length < 1) {
        throw new NotFoundRecord()
      }
      session.close()
      let r = record.records[0]
      let t: INodeTutoriel = r.get('t')
      let f: INodeFormation = r.get('f')
      let tutoriel = new Tutoriel()
      tutoriel.name = t.name
      tutoriel.slug = t.slug
      tutoriel.id = t.uuid
      tutoriel.youtube = t.youtube
      tutoriel.createdAt = new Date(t.created_at * 1000)
      tutoriel.video = t.video
      tutoriel.content = t.content
      tutoriel.image = t.image
      if (f) {
        tutoriel.formation = { chapters: r.get('siblings') * 1, ...f }
        tutoriel.position = r.get('previous') * 1 + 1
      }
      tutoriel.technologies = r.get('techs')
      return tutoriel
    } catch (e) {
      session.close()
      throw e
    }
  }

  static async updateYoutube (id: number, youtube: string) {
    let driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', process.env.DB_PASSWORD))
    let session = driver.session()
    session.run(`
        MATCH (t:Tutoriel {uuid: {id}})
        SET t.youtube = {youtube}
        RETURN t {.uuid}
        `, { id, youtube })
    session.close()
  }

}
