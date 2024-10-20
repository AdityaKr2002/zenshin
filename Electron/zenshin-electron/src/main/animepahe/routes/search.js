import { app } from 'electron'
import express from 'express'
import fs, { stat } from 'fs'
import path from 'path'
import cookieMiddleware from '../middlewares/cookies'

const router = express.Router() // Use a router to define routes

// Define the /search route with the cookieMiddleware
router.get('/search', cookieMiddleware, async (req, res) => {
  console.log(`Search query: ${req.query.q}`)
  const { cookiesString, baseUrl } = req // Access baseUrl and cookiesString

  try {
    const response = await fetch(`${baseUrl}/api?m=search&q=${req.query.q}`, {
      headers: {
        Cookie: cookiesString
      }
    })

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).send({
          status: 403,
          error: 'Please use webview to enter the website then close the webview window.'
        })
      }
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// Use the same middleware for /latest route
router.get('/latest', cookieMiddleware, async (req, res) => {
  const { cookiesString, baseUrl } = req
  const page = req.query.page || 1

  try {
    const response = await fetch(`${baseUrl}/api?m=airing&page=${page}`, {
      headers: {
        Cookie: cookiesString
      }
    })

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).send({
          status: 403,
          error: 'Please use webview to enter the website then close the webview window.'
        })
      }
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// Route: /details
router.get('/details', cookieMiddleware, async (req, res) => {
  try {
    const { id } = req.query
    console.log(`Detail query: ${id}`)

    const { cookiesString, baseUrl } = req

    const response = await fetch(`${baseUrl}/anime/${id}`, {
      headers: {
        Cookie: cookiesString
      }
    })

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).send({
          status: 403,
          error: 'Please use webview to enter the website then close the webview window.'
        })
      }
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.text()
    const title = data.match(/<span>(.+?)<\/span>/)[1]
    const cover = data.match(/<a href="(https:\/\/i.animepahe.ru\/posters.+?)"/)[1]
    const desc = data.match(/<div class="anime-synopsis">(.+?)<\/div>/)[1]
    const anilist_id = data.match(/<a href="\/\/anilist.co\/anime\/(.+?)"/)

    res.status(200).send({
      title: title,
      anilist_id: anilist_id ? anilist_id[1] : null,
      cover: cover,
      desc: desc
    })
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// Route: /episodes
router.get('/episodes', cookieMiddleware, async (req, res) => {
  const { id } = req.query
  const page = req.query.page || 1

  try {
    const { cookiesString, baseUrl } = req

    const response = await fetch(`${baseUrl}/api?m=release&id=${id}&page=${page}`, {
      headers: {
        Cookie: cookiesString
      }
    })

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).send({
          status: 403,
          error: 'Please use webview to enter the website then close the webview window.'
        })
      }
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// Route: /getallepisodes
router.get('/getallepisodes', cookieMiddleware, async (req, res) => {
  const { id } = req.query
  let currentPage = req.query.page || 1
  let lastPage = 1
  let allEpisodes = []

  try {
    const { cookiesString, baseUrl } = req

    do {
      const response = await fetch(`${baseUrl}/api?m=release&id=${id}&page=${currentPage}`, {
        headers: {
          Cookie: cookiesString
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          return res.status(403).send({
            status: 403,
            error: 'Please use webview to enter the website then close the webview window.'
          })
        }
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const data = await response.json()
      allEpisodes = allEpisodes.concat(data.data)
      currentPage = data.current_page + 1
      lastPage = data.last_page
    } while (currentPage <= lastPage)

    res.json({
      total: allEpisodes.length,
      episodes: allEpisodes
    })
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// Route: /play
router.get('/play', cookieMiddleware, async (req, res) => {
  const { id, episode } = req.query

  try {
    const { cookiesString, baseUrl } = req

    console.log(`Play query: ${id}, Episode: ${episode}`)
    const response = await fetch(`${baseUrl}/play/${id}/${episode}`, {
      headers: {
        Cookie: cookiesString
      }
    })

    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).send({
          status: 403,
          error: 'Please use webview to enter the website then close the webview window.'
        })
      }
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const resp = await response.text()
    fs.writeFileSync('play.html', resp)

    const srcMatch = resp.match(/data-src="(https:\/\/kwik\.si.+?)"/)
    const src = srcMatch ? srcMatch[1] : null

    if (src) {
      console.log('Source: ', src)

      const hid_res = await fetch(src, {
        headers: {
          Referer: 'https://animepahe.com',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.56'
        }
      })

      if (!hid_res.ok) {
        throw new Error(`HTTP error! Status: ${hid_res.status}`)
      }

      const hid_data = await hid_res.text()
      const hid_script = hid_data.match(/eval\(f.+?\}\)\)/g)[1]
      const decode_script = eval(hid_script.match(/eval(.+)/)[1])
      const decode_url = decode_script.match(/source='(.+?)'/)[1]

      console.log('Decode URL: ', decode_url)

      res.status(200).send({
        url: decode_url
      })
    } else {
      throw new Error('Failed to find source in the HTML.')
    }
  } catch (error) {
    console.error(`Failed to fetch webpage: ${error.message}`)
    res.status(500).send({
      status: 500,
      error: error.message
    })
  }
})

// export default router

export { router as animepaheRouter }
