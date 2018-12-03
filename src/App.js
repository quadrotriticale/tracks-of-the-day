import React, { Component } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import DayPicker from 'react-day-picker';
import 'react-day-picker/lib/style.css';
import { PlayCircle, FolderPlus, Calendar } from 'react-feather';
import './style.scss';

const spotifyApi = new SpotifyWebApi();

class App extends Component {

  constructor(props){
    super(props);
    this.state = {
      loggedIn: false,
      tracks: [],
      date: new Date(),
      selectedDay: null,
      playlistMessage: null
    }
    this.months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  }

  componentDidMount() {

    const params = this.getHashParams();
    const token = params.access_token;
    if (token) {
      spotifyApi.setAccessToken(token);
      this.setState({ loggedIn: true });
      this.getTodayTracks(this.state.date);
    }

  }

  loginToSpotify = () => {
    const client_id = "c5425ff345764ec4a0c40f1a7a2ec333";
    const redirect_uri = document.location.href;
    const scope = "user-read-private user-read-email playlist-modify-private";
    const state = this.generateRandomString(16);

    const url = 'https://accounts.spotify.com/authorize' +
                '?response_type=token' +
                '&client_id=' + encodeURIComponent(client_id) +
                '&scope=' + encodeURIComponent(scope) +
                '&redirect_uri=' + encodeURIComponent(redirect_uri) +
                '&state=' + encodeURIComponent(state);

    window.location = url;
  }

  generateRandomString(length) {

    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;

  }

  getHashParams() {

    let hashParams = {};
    const re = /([^&;=]+)=?([^&;]*)/g;
    const q = window.location.hash.substring(1);
    let e = re.exec(q);
    while (e) {
       hashParams[e[1]] = decodeURIComponent(e[2]);
       e = re.exec(q);
    }
    return hashParams;

  }


  async getTracksForTheDay(month, day) {
    
    const monthName = this.months[month];
    const dayWithSuffix = day + this.getOrdinalSuffix(day);

    // Fetch search results
    const response1 = await spotifyApi.searchTracks(`${monthName} ${dayWithSuffix} NOT live`);
    const response2 = await spotifyApi.searchTracks(`${monthName} ${day} NOT live`);
    let tracks = [...response1.tracks.items, ...response2.tracks.items];

    // Check if date is really in the title
    tracks = tracks.filter(track => this.isDateIncludedInName(track.name, month, day));

    // Sort by popularity
    tracks.sort((a, b) => a.popularity < b.popularity);

    // Remove duplicate tracks
    const uniqueTracks = [];
    tracks.forEach(track => {
      if (!uniqueTracks.some(uniqueTrack => uniqueTrack.artists[0].name === track.artists[0].name && uniqueTrack.name === track.name && uniqueTrack.id !== track.id))
        uniqueTracks.push(track);
    })

    // Truncate long track and artist names
    const maxLength = 22;
    tracks = uniqueTracks.map(track => {
      if (track.name.length < maxLength && track.artists[0].name.length < maxLength) return track;
      const truncatedTrackName = track.name.length > maxLength ? track.name.substring(0, 22).concat('...') : track.name;
      const truncatedArtistName = track.artists[0].name.length > maxLength ? track.artists[0].name.substring(0, 22).concat('...') : track.artists[0].name;
      const newTrack = {...track};
      newTrack.name = truncatedTrackName;
      newTrack.artists[0].name = truncatedArtistName;
      return newTrack;
    })

    return tracks;

  }

  getOrdinalSuffix(day) {

    const lastDigit = day[day.length - 1];

    if (lastDigit > 0 && lastDigit < 4) {
      if (day > 10 && day < 14)
        return 'th';
      else {
        switch(day[day.length - 1]) {
          case '1': return 'st';
          case '2': return 'nd';
          case '3': return 'rd';
        }
      }
    }
    return 'th';

  }


  isDateIncludedInName(trackName, month, day) {

    const monthName = this.months[month];
    const re = new RegExp(`${monthName}\\W*\\s${day}(?!\\d)`, 'i');

    return re.test(trackName);

  }


  async getTodayTracks(date) {

    const response = await this.getTracksForTheDay(date.getMonth(), date.getDate());
    this.setState({ tracks: response });

  }

  async createPlaylist() {
    
    const {date} = this.state;
    const playlistName = `${this.months[date.getMonth()]} ${date.getDate()}`;

    spotifyApi.createPlaylist({name: playlistName, public: false}, (error, response) => {
      if (error) {
        this.setState({ playlistMessage: 'An error occurred' });
        setTimeout(
          () => this.setState({ playlistMessage: null }),
          2000
        );
        return;
      }
      const playlistId = response.id;
      const uris = this.state.tracks.map(track => track.uri);
      spotifyApi.addTracksToPlaylist(playlistId, uris, (error, response) => {
        const message = error ? 'An error occurred' : 'Playlist was created';
        this.setState({ playlistMessage: message });
        setTimeout(
          () => this.setState({ playlistMessage: null }),
          2000
        );
      });
    })

  }

  handleDayClick = day => {

    this.setState({ date: day, selectedDay: day });
    this.getTodayTracks(day);

  }


  renderApp() {

    return (
      <div className="App">
        <div className="container">
          {this.renderCalendar()}
          {this.renderResults()}
        </div>
      </div>
    );

  }

  renderLoginScreen() {

    return(
      <div className="background">
        <div className="content">
          <p>Discover music that includes a specific date in the title.</p>
          <h2>
            <span onClick={this.loginToSpotify} className="button-transparent">Login to Spotify</span>
            <span> to get started.</span>
          </h2>
        </div>
      </div>
    )

  }

  renderCalendar() {

    return(
      <div className="calendar">
        <DayPicker
          selectedDays={this.state.selectedDay}
          onDayClick={this.handleDayClick}
        ></DayPicker>
        <div>
          <button onClick={() => this.getTodayTracks()} className="buttonWithIcon">
            <Calendar className="icon" size={14}></Calendar>
            Go to today
          </button>
        </div>
      </div>
    )

  }

  renderResults() {

    const {tracks, date} = this.state;
    let resultsText = tracks.length > 0 ? 'Results' : 'No results';
    resultsText += ` for ${this.months[date.getMonth()]} ${date.getDate()}${this.getOrdinalSuffix(date.getDate())}`;
    
    return(
      <div className="results">

        <div className="results-header">
          <h2><span className="results-header-text">Tracks for the day</span></h2>
          <p className="text-opacity">{resultsText}</p>
        </div>
        
        <div className="tracks">
          {
            tracks.map(track => {
              return(
                <a href={track.external_urls.spotify} key={track.id} className="track">
                  <div className="image-wrapper">
                    <img src={track.album.images[1].url} />
                    <PlayCircle className="image-icon" size={42}></PlayCircle>
                  </div>
                  <span className="track-text artist">{track.artists[0].name}</span>
                  <span className="track-text title">{track.name}</span>
                </a>
              )
            })
          }
        </div>

        <div className="playlist">
          {
            this.state.tracks.length > 0 && 
            <button onClick={() => this.createPlaylist()} className="buttonWithIcon">
              <FolderPlus className="icon" size={14}></FolderPlus>
              Create playlist for this day
            </button>
          }
          {
            this.state.playlistMessage &&
            <div className="playlist-message">{this.state.playlistMessage}</div>
          }
        </div>

      </div>
    )
  }

  render() {

    return(
      <div>
      {
        this.state.loggedIn ?
        this.renderApp() :
        this.renderLoginScreen()
      }
      </div>
    )

  }
}

export default App;
