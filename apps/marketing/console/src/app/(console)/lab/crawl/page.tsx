import type { Metadata } from 'next'
import { PageHead } from '@/components/ui'
import { requireStaff } from '@/lib/staff'
import { CrawlView } from './crawl-view'

export const metadata: Metadata = { title: '크롤링 테스트' }

export default async function CrawlTestPage() {
  await requireStaff()
  return (
    <>
      <PageHead title="크롤링 테스트" sub="네이버 플레이스·카카오맵·당근·인스타그램·홈페이지 주소로 가게 정보·사진·소식·메뉴·리뷰를 어디까지 가져올 수 있는지 확인해요. 저장하지 않아요." />
      <CrawlView />
    </>
  )
}
